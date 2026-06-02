import { CONFIG } from "./config.js";
import { request } from "./request.js";
import {
  ensureArray,
  matchByName,
  parseDateInput,
  xmlEscape,
  icalEscape,
  formatCalDavDate,
} from "./utils.js";
import crypto from "node:crypto";

export const CalDAV = {
  async findCalendars(componentType = null) {
    const endpoint = `/remote.php/dav/calendars/${CONFIG.user}/`;
    const response = await request(endpoint, {
      method: "PROPFIND",
      headers: { Depth: "1" },
    });

    if (!response["d:multistatus"] || !response["d:multistatus"]["d:response"])
      return [];

    const responses = ensureArray(response["d:multistatus"]["d:response"]);

    return responses
      .map((r) => {
        const propstats = ensureArray(r["d:propstat"]);
        if (!propstats[0] || !propstats[0]["d:prop"]) return null;
        const props = propstats[0]["d:prop"];

        if (
          !props["d:resourcetype"] ||
          !("cal:calendar" in props["d:resourcetype"])
        )
          return null;

        let compType = null;
        const compSet = props["cal:supported-calendar-component-set"];
        if (compSet && compSet["cal:comp"]) {
          const comps = Array.isArray(compSet["cal:comp"])
            ? compSet["cal:comp"]
            : [compSet["cal:comp"]];
          const match = componentType
            ? comps.find((c) => c["@_name"] === componentType)
            : comps[0];
          compType = match ? match["@_name"] : comps[0]["@_name"];
        }

        return {
          url: r["d:href"],
          displayname: props["d:displayname"],
          componentType: compType,
        };
      })
      .filter(
        (c) => c && (!componentType || c.componentType === componentType),
      );
  },

  async getEvents(start, end) {
    const calendars = await this.findCalendars("VEVENT");
    const allEvents = [];

    const startStr = formatCalDavDate(parseDateInput(start));
    const endStr = formatCalDavDate(parseDateInput(end));

    const body = `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${xmlEscape(startStr)}" end="${xmlEscape(endStr)}" />
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

    for (const cal of calendars) {
      try {
        const response = await request(cal.url, {
          method: "REPORT",
          headers: { Depth: "1", "Content-Type": "application/xml" },
          body: body,
        });

        if (
          !response["d:multistatus"] ||
          !response["d:multistatus"]["d:response"]
        )
          continue;
        const responses = ensureArray(response["d:multistatus"]["d:response"]);

        for (const r of responses) {
          const propstats = ensureArray(r["d:propstat"]);
          if (!propstats[0] || !propstats[0]["d:prop"]) continue;

          const calData = propstats[0]["d:prop"]["cal:calendar-data"];
          const unfolded = calData.replace(/\r?\n[ \t]/g, "");

          const uidMatch = calData.match(/UID:(.*)/);
          const summaryMatch = calData.match(/SUMMARY:(.*)/);
          const descriptionMatch = unfolded.match(
            /^DESCRIPTION(?:;[^:]*)?:(.*)$/m,
          );
          const dtstartMatch = calData.match(/DTSTART(?:;.*)?:(.*)/);
          const dtendMatch = calData.match(/DTEND(?:;.*)?:(.*)/);
          const locationMatch = calData.match(/LOCATION:(.*)/);

          allEvents.push({
            uid: uidMatch ? uidMatch[1].trim() : "No UID",
            calendar: cal.displayname,
            summary: summaryMatch ? summaryMatch[1].trim() : "No Title",
            description: descriptionMatch ? descriptionMatch[1].trim() : null,
            start: dtstartMatch ? dtstartMatch[1].trim() : "Unknown",
            end: dtendMatch ? dtendMatch[1].trim() : null,
            location: locationMatch ? locationMatch[1].trim() : null,
          });
        }
      } catch (e) {
        console.error("Calendar error:", e.message);
      }
    }
    return allEvents;
  },

  async getCalendarColor(calendarUrl) {
    if (!calendarUrl) throw new Error("Calendar URL is required.");

    const response = await request(calendarUrl, {
      method: "PROPFIND",
      headers: { Depth: "0" },
      body: `<?xml version="1.0"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <cal:calendar-color xmlns:cal="urn:ietf:params:xml:ns:calendar-server" />
  </D:prop>
</D:propfind>`,
    });

    if (
      !response["d:multistatus"] ||
      !response["d:multistatus"]["d:response"]
    ) {
      throw new Error("Could not retrieve calendar color");
    }

    const responses = ensureArray(response["d:multistatus"]["d:response"]);
    const props = responses[0]?.["d:propstat"]?.[0]?.["d:prop"];

    return props?.["cal:calendar-color"] || "#000000";
  },

  async setCalendarColor(calendarUrl, color) {
    if (!calendarUrl) throw new Error("Calendar URL is required.");
    if (!color) throw new Error("Color is required (format: #RRGGBB)");

    const body = `<?xml version="1.0"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:cal="urn:ietf:params:xml:ns:calendar-server">
  <D:set>
    <D:prop>
      <cal:calendar-color>${xmlEscape(color)}</cal:calendar-color>
    </D:prop>
  </D:set>
</D:propertyupdate>`;

    await request(calendarUrl, {
      method: "PROPPATCH",
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: body,
    });

    return { calendarUrl, color, status: "updated" };
  },

  async getTodos(calendarName = null) {
    let calendars = await this.findCalendars("VTODO");
    if (calendarName) {
      const matched = matchByName(calendars, calendarName);
      if (!matched) {
        const available =
          calendars.map((c) => c.displayname).join(", ") || "(none)";
        throw new Error(
          `Task-enabled calendar '${calendarName}' not found. Available: ${available}`,
        );
      }
      calendars = [matched];
    }

    const allTodos = [];

    const body = `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
    <c:uid />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VTODO">
        <c:prop-filter name="STATUS">
          <c:text-match negate-condition="yes">COMPLETED</c:text-match>
        </c:prop-filter>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

    for (const cal of calendars) {
      try {
        const response = await request(cal.url, {
          method: "REPORT",
          headers: { Depth: "1", "Content-Type": "application/xml" },
          body: body,
        });

        if (
          !response["d:multistatus"] ||
          !response["d:multistatus"]["d:response"]
        )
          continue;
        const responses = ensureArray(response["d:multistatus"]["d:response"]);

        for (const r of responses) {
          const propstats = ensureArray(r["d:propstat"]);
          if (!propstats[0] || !propstats[0]["d:prop"]) continue;

          const calData = propstats[0]["d:prop"]["cal:calendar-data"];
          const unfolded = calData.replace(/\r?\n[ \t]/g, "");

          const summaryMatch = calData.match(/SUMMARY:(.*)/);
          const descriptionMatch = unfolded.match(
            /^DESCRIPTION(?:;[^:]*)?:(.*)$/m,
          );
          const statusMatch = calData.match(/STATUS:(.*)/);
          const uidMatch = calData.match(/UID:(.*)/);
          const dueMatch = calData.match(/DUE(?:;.*)?:(.*)/);
          const priorityMatch = calData.match(/PRIORITY:(.*)/);

          allTodos.push({
            uid: uidMatch ? uidMatch[1].trim() : "No UID",
            calendar: cal.displayname,
            summary: summaryMatch ? summaryMatch[1].trim() : "No Title",
            description: descriptionMatch ? descriptionMatch[1].trim() : null,
            status: statusMatch ? statusMatch[1].trim() : "NEEDS-ACTION",
            due: dueMatch ? dueMatch[1].trim() : null,
            priority: priorityMatch
              ? parseInt(priorityMatch[1].trim(), 10)
              : null,
          });
        }
      } catch (e) {
        console.error("Calendar error:", e.message);
      }
    }
    return allTodos;
  },

  async getCalendar(calendarName, componentType = null) {
    const calendars = await this.findCalendars(componentType);
    let targetCal = null;
    if (calendarName) {
      targetCal = matchByName(calendars, calendarName);
    } else if (calendars.length > 0) {
      targetCal = calendars[0];
    }

    if (!targetCal) {
      const typeDesc =
        componentType === "VTODO"
          ? "task-enabled "
          : componentType === "VEVENT"
            ? "event-enabled "
            : "";
      if (calendarName) {
        const available =
          calendars.map((c) => c.displayname).join(", ") || "(none)";
        throw new Error(
          `${typeDesc}Calendar '${calendarName}' not found. Available: ${available}`,
        );
      }
      throw new Error(`No ${typeDesc}calendars found.`);
    }
    return targetCal;
  },

  async findTaskPath(uid, calendarName) {
    const calendars = await this.findCalendars("VTODO");
    let searchTargets = calendars;
    if (calendarName) {
      const found = matchByName(calendars, calendarName);
      if (found) searchTargets = [found];
      else {
        const available =
          calendars.map((c) => c.displayname).join(", ") || "(none)";
        throw new Error(
          `Task-enabled calendar '${calendarName}' not found. Available: ${available}`,
        );
      }
    }

    const body = `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VTODO">
        <c:prop-filter name="UID">
          <c:text-match collation="i;octet">${xmlEscape(uid)}</c:text-match>
        </c:prop-filter>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

    for (const cal of searchTargets) {
      try {
        const response = await request(cal.url, {
          method: "REPORT",
          headers: { Depth: "1", "Content-Type": "application/xml" },
          body: body,
        });

        if (
          !response["d:multistatus"] ||
          !response["d:multistatus"]["d:response"]
        )
          continue;

        const responses = ensureArray(response["d:multistatus"]["d:response"]);

        if (responses.length > 0) {
          const propstats = ensureArray(responses[0]["d:propstat"]);
          return {
            href: responses[0]["d:href"],
            etag: propstats[0]["d:prop"]["d:getetag"],
            data: propstats[0]["d:prop"]["cal:calendar-data"],
            calendarUrl: cal.url,
          };
        }
      } catch (e) {
        console.error("Find task error:", e.message);
      }
    }
    return null;
  },

  _updateProperty(vcal, prop, value) {
    if (value === null || value === undefined) {
      return vcal;
    }
    const regex = new RegExp(`^${prop}(;[^:\r\n]*)?:.*$`, "m");
    const newLine = `${prop}$1:${icalEscape(value)}`;
    if (regex.test(vcal)) {
      return vcal.replace(regex, newLine);
    }
    const endMatch = vcal.match(/END:(VTODO|VEVENT)/);
    if (!endMatch) {
      throw new Error(
        "Cannot insert property: no END:VTODO or END:VEVENT found in calendar data.",
      );
    }
    return vcal.replace(endMatch[0], `${prop}:${icalEscape(value)}\n${endMatch[0]}`);
  },

  async createTask(title, calendarName, dueDate, priority, description) {
    const cal = await this.getCalendar(calendarName, "VTODO");
    const uid = crypto.randomUUID();
    const now = new Date();
    const dtstamp = formatCalDavDate(now);

    let vtodo = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//OpenClaw//Nextcloud Skill//EN\nBEGIN:VTODO\nUID:${uid}\nDTSTAMP:${dtstamp}\nSUMMARY:${icalEscape(title)}\nSTATUS:NEEDS-ACTION\n`;

    if (dueDate) {
      const due = parseDateInput(dueDate);
      vtodo += `DUE:${formatCalDavDate(due)}\n`;
    }

    if (priority) vtodo += `PRIORITY:${priority}\n`;
    if (description) vtodo += `DESCRIPTION:${icalEscape(description)}\n`;

    vtodo += `END:VTODO\nEND:VCALENDAR`;

    const filename = `${uid}.ics`;
    const urlWithSlash = cal.url.endsWith("/") ? cal.url : cal.url + "/";
    const endpoint = `${urlWithSlash}${filename}`;

    await request(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "If-None-Match": "*",
      },
      body: vtodo,
    });

    return { uid, status: "created", calendar: cal.displayname };
  },

  async updateTask(uid, calendarName, updates) {
    const task = await this.findTaskPath(uid, calendarName);
    if (!task) throw new Error(`Task ${uid} not found.`);

    let vtodo = task.data;

    if (updates.title)
      vtodo = this._updateProperty(vtodo, "SUMMARY", updates.title);
    if (updates.priority)
      vtodo = this._updateProperty(vtodo, "PRIORITY", updates.priority);
    if (updates.description)
      vtodo = this._updateProperty(vtodo, "DESCRIPTION", updates.description);
    if (updates.dueDate) {
      const due = parseDateInput(updates.dueDate);
      vtodo = this._updateProperty(
        vtodo,
        "DUE",
        formatCalDavDate(due),
      );
    }

    await request(task.href, {
      method: "PUT",
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "If-Match": task.etag,
      },
      body: vtodo,
    });
    return { uid, status: "updated" };
  },

  async deleteTask(uid, calendarName) {
    const task = await this.findTaskPath(uid, calendarName);
    if (!task) throw new Error(`Task ${uid} not found.`);

    await request(task.href, {
      method: "DELETE",
    });
    return { uid, status: "deleted" };
  },

  async completeTask(uid, calendarName) {
    const task = await this.findTaskPath(uid, calendarName);
    if (!task) throw new Error(`Task ${uid} not found.`);

    let vtodo = task.data;
    const now = new Date();
    const completedDate = formatCalDavDate(now);

    vtodo = this._updateProperty(vtodo, "STATUS", "COMPLETED");
    vtodo = this._updateProperty(vtodo, "COMPLETED", completedDate);
    vtodo = this._updateProperty(vtodo, "PERCENT-COMPLETE", "100");

    await request(task.href, {
      method: "PUT",
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "If-Match": task.etag,
      },
      body: vtodo,
    });
    return { uid, status: "completed" };
  },

  async createEvent(summary, start, end, calendarName, description, location) {
    const cal = await this.getCalendar(calendarName, "VEVENT");
    const uid = crypto.randomUUID();
    const now = new Date();
    const dtstamp = formatCalDavDate(now);

    let vevent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//OpenClaw//Nextcloud Skill//EN\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${dtstamp}\nSUMMARY:${icalEscape(summary)}\nDTSTART:${formatCalDavDate(parseDateInput(start))}\nDTEND:${formatCalDavDate(parseDateInput(end))}\n`;

    if (description) vevent += `DESCRIPTION:${icalEscape(description)}\n`;
    if (location) vevent += `LOCATION:${icalEscape(location)}\n`;

    vevent += `END:VEVENT\nEND:VCALENDAR`;

    const filename = `${uid}.ics`;
    const urlWithSlash = cal.url.endsWith("/") ? cal.url : cal.url + "/";
    const endpoint = `${urlWithSlash}${filename}`;

    await request(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "If-None-Match": "*",
      },
      body: vevent,
    });

    return { uid, status: "created", calendar: cal.displayname };
  },

  async findEventPath(uid, calendarName) {
    const calendars = await this.findCalendars("VEVENT");
    let searchTargets = calendars;
    if (calendarName) {
      const found = matchByName(calendars, calendarName);
      if (found) searchTargets = [found];
      else {
        const available =
          calendars.map((c) => c.displayname).join(", ") || "(none)";
        throw new Error(
          `Event-enabled calendar '${calendarName}' not found. Available: ${available}`,
        );
      }
    }

    const body = `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:prop-filter name="UID">
          <c:text-match collation="i;octet">${xmlEscape(uid)}</c:text-match>
        </c:prop-filter>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

    for (const cal of searchTargets) {
      try {
        const response = await request(cal.url, {
          method: "REPORT",
          headers: { Depth: "1", "Content-Type": "application/xml" },
          body: body,
        });

        if (
          !response["d:multistatus"] ||
          !response["d:multistatus"]["d:response"]
        )
          continue;

        const responses = ensureArray(response["d:multistatus"]["d:response"]);

        if (responses.length > 0) {
          const propstats = ensureArray(responses[0]["d:propstat"]);
          return {
            href: responses[0]["d:href"],
            etag: propstats[0]["d:prop"]["d:getetag"],
            data: propstats[0]["d:prop"]["cal:calendar-data"],
            calendarUrl: cal.url,
          };
        }
      } catch (e) {
        console.error("Find event error:", e.message);
      }
    }
    return null;
  },

  async updateEvent(uid, calendarName, updates) {
    const event = await this.findEventPath(uid, calendarName);
    if (!event) throw new Error(`Event ${uid} not found.`);

    let vevent = event.data;

    if (updates.summary)
      vevent = this._updateProperty(vevent, "SUMMARY", updates.summary);
    if (updates.start) {
      const d = parseDateInput(updates.start);
      vevent = this._updateProperty(vevent, "DTSTART", formatCalDavDate(d));
    }
    if (updates.end) {
      const d = parseDateInput(updates.end);
      vevent = this._updateProperty(vevent, "DTEND", formatCalDavDate(d));
    }
    if (updates.description !== undefined) {
      vevent = this._updateProperty(vevent, "DESCRIPTION", updates.description);
    }
    if (updates.location !== undefined) {
      vevent = this._updateProperty(vevent, "LOCATION", updates.location);
    }

    await request(event.href, {
      method: "PUT",
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "If-Match": event.etag,
      },
      body: vevent,
    });
    return { uid, status: "updated" };
  },

  async deleteEvent(uid, calendarName) {
    const event = await this.findEventPath(uid, calendarName);
    if (!event) throw new Error(`Event ${uid} not found.`);

    await request(event.href, {
      method: "DELETE",
    });
    return { uid, status: "deleted" };
  },
};
