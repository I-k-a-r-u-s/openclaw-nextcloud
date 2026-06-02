import { CONFIG } from "./config.js";
import { request } from "./request.js";
import { ensureArray, matchByName, xmlEscape, vcardEscape } from "./utils.js";
import crypto from "node:crypto";

export const Contacts = {
  async findAddressBooks() {
    const endpoint = `/remote.php/dav/addressbooks/users/${CONFIG.user}/`;
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
          !("card:addressbook" in props["d:resourcetype"])
        )
          return null;

        let name = props["d:displayname"];
        if (!name) {
          const urlParts = r["d:href"].split("/").filter((p) => p);
          name = urlParts[urlParts.length - 1] || "Unnamed";
        }

        return {
          url: r["d:href"],
          displayname: name,
        };
      })
      .filter((a) => a);
  },

  async getAddressBook(addressBookName) {
    const addressBooks = await this.findAddressBooks();
    let target = null;
    if (addressBookName) {
      target = matchByName(addressBooks, addressBookName);
    } else if (addressBooks.length > 0) {
      target = addressBooks[0];
    }

    if (!target) {
      if (addressBookName) {
        const available =
          addressBooks.map((a) => a.displayname).join(", ") || "(none)";
        throw new Error(
          `Address book '${addressBookName}' not found. Available: ${available}`,
        );
      }
      throw new Error("No address books found.");
    }
    return target;
  },

  async list(addressBookName = null) {
    let addressBooks = await this.findAddressBooks();
    if (addressBookName) {
      const matched = matchByName(addressBooks, addressBookName);
      if (!matched) {
        const available =
          addressBooks.map((a) => a.displayname).join(", ") || "(none)";
        throw new Error(
          `Address book '${addressBookName}' not found. Available: ${available}`,
        );
      }
      addressBooks = [matched];
    }

    const allContacts = [];

    const body = `<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag />
    <card:address-data />
  </d:prop>
</card:addressbook-query>`;

    for (const ab of addressBooks) {
      try {
        const response = await request(ab.url, {
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

          const cardData = propstats[0]["d:prop"]["card:address-data"];
          if (!cardData) continue;

          const contact = this._parseVCard(cardData);
          contact.addressBook = ab.displayname;
          contact.href = r["d:href"];
          allContacts.push(contact);
        }
      } catch (e) {
        console.error("Address book error:", e.message);
      }
    }
    return allContacts;
  },

  _parseVCard(vcard) {
    const cleanValue = (val) =>
      val ? val.replace(/&#13;/g, "").replace(/\r/g, "").trim() : null;

    const getField = (field) => {
      const regex = new RegExp(`^${field}(?:;[^:]*)?:(.*)$`, "mi");
      const match = vcard.match(regex);
      return match ? cleanValue(match[1]) : null;
    };

    const getFieldWithTypes = (field) => {
      const regex = new RegExp(`^${field}([^:\n]*):([^\n]*)`, "gm");
      const matches = [];
      let match;
      while ((match = regex.exec(vcard)) !== null) {
        const types = match[1].toUpperCase().split(";").filter(Boolean);
        const value = cleanValue(match[2]);
        matches.push({ types, value });
      }
      return matches.length > 0 ? matches : null;
    };

    const uid = getField("UID");
    const fn = getField("FN");
    const n = getField("N");
    const bday = getField("BDAY");
    const anniversary = getField("ANNIVERSARY");
    const url = getField("URL");
    const role = getField("ROLE");
    const phones = getFieldWithTypes("TEL");
    const emails = getFieldWithTypes("EMAIL");
    const addresses = getFieldWithTypes("ADR");
    const parsedAddresses = addresses?.map((addr) => ({
      types: addr.types,
      value: addr.value,
      street: addr.value?.split(";")[2] || null,
      city: addr.value?.split(";")[3] || null,
      region: addr.value?.split(";")[4] || null,
      postalCode: addr.value?.split(";")[5] || null,
      country: addr.value?.split(";")[6] || null,
    }));

    const org = getField("ORG");
    const title = getField("TITLE");
    const note = getField("NOTE");

    return {
      uid: uid,
      fullName: fn,
      name: n,
      bday: bday,
      anniversary: anniversary,
      url: url,
      role: role,
      phones: phones,
      emails: emails,
      addresses: parsedAddresses,
      organization: org,
      title: title,
      note: note,
    };
  },

  async get(uid, addressBookName = null) {
    const contacts = await this.list(addressBookName);
    const contact = contacts.find((c) => c.uid === uid);
    if (!contact) {
      throw new Error(`Contact with UID '${uid}' not found.`);
    }
    return contact;
  },

  async findContactPath(uid, addressBookName = null) {
    let addressBooks = await this.findAddressBooks();
    if (addressBookName) {
      const found = matchByName(addressBooks, addressBookName);
      if (found) addressBooks = [found];
      else {
        const available =
          addressBooks.map((a) => a.displayname).join(", ") || "(none)";
        throw new Error(
          `Address book '${addressBookName}' not found. Available: ${available}`,
        );
      }
    }

    const body = `<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag />
    <card:address-data />
  </d:prop>
  <card:filter>
    <card:prop-filter name="UID">
      <card:text-match collation="i;octet">${xmlEscape(uid)}</card:text-match>
    </card:prop-filter>
  </card:filter>
</card:addressbook-query>`;

    for (const ab of addressBooks) {
      try {
        const response = await request(ab.url, {
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
            data: propstats[0]["d:prop"]["card:address-data"],
            addressBookUrl: ab.url,
          };
        }
      } catch (e) {
        console.error("Find contact error:", e.message);
      }
    }
    return null;
  },

  async create(fullName, addressBookName, options = {}) {
    const ab = await this.getAddressBook(addressBookName);
    const uid = crypto.randomUUID();

    let vcard = `BEGIN:VCARD\nVERSION:3.0\nUID:${uid}\nFN:${vcardEscape(fullName)}\n`;

    const nameParts = fullName.split(" ");
    if (nameParts.length >= 2) {
      const lastName = nameParts[nameParts.length - 1];
      const firstName = nameParts.slice(0, -1).join(" ");
      vcard += `N:${vcardEscape(lastName)};${vcardEscape(firstName)};;;\n`;
    } else {
      vcard += `N:${vcardEscape(fullName)};;;;\n`;
    }

    if (options.email) {
      const emailType = options.emailType ? `;${options.emailType}` : "";
      vcard += `EMAIL${emailType}:${vcardEscape(options.email)}\n`;
    }
    if (options.phone) {
      const phoneType = options.phoneType ? `;${options.phoneType}` : "";
      vcard += `TEL${phoneType}:${vcardEscape(options.phone)}\n`;
    }
    if (options.organization)
      vcard += `ORG:${vcardEscape(options.organization)}\n`;
    if (options.title) vcard += `TITLE:${vcardEscape(options.title)}\n`;
    if (options.note) vcard += `NOTE:${vcardEscape(options.note)}\n`;
    if (options.bday) vcard += `BDAY:${vcardEscape(options.bday)}\n`;
    if (options.anniversary)
      vcard += `ANNIVERSARY:${vcardEscape(options.anniversary)}\n`;
    if (options.url) vcard += `URL:${vcardEscape(options.url)}\n`;
    if (options.role) vcard += `ROLE:${vcardEscape(options.role)}\n`;

    if (options.address) {
      const addrParts = options.address.split("|");
      vcard += `ADR:;;${addrParts.map(vcardEscape).join(";")}\n`;
    }

    vcard += `END:VCARD`;

    const filename = `${uid}.vcf`;
    const urlWithSlash = ab.url.endsWith("/") ? ab.url : ab.url + "/";
    const endpoint = `${urlWithSlash}${filename}`;

    await request(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "If-None-Match": "*",
      },
      body: vcard,
    });

    return { uid, status: "created", addressBook: ab.displayname };
  },

  _updateVCardField(vcard, field, value) {
    const regex = new RegExp(`^${field}(;[^:\n]*)?:.*$`, "mi");
    const newLine = `${field}$1:${vcardEscape(value)}`;
    if (regex.test(vcard)) {
      return vcard.replace(regex, newLine);
    }
    return vcard.replace(
      "END:VCARD",
      `${field}:${vcardEscape(value)}\nEND:VCARD`,
    );
  },

  async update(uid, addressBookName, updates) {
    const contact = await this.findContactPath(uid, addressBookName);
    if (!contact) throw new Error(`Contact ${uid} not found.`);

    let vcard = contact.data;

    if (updates.fullName) {
      vcard = this._updateVCardField(vcard, "FN", updates.fullName);
      const nameParts = updates.fullName.split(" ");
      if (nameParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1];
        const firstName = nameParts.slice(0, -1).join(" ");
        vcard = this._updateVCardField(
          vcard,
          "N",
          `${lastName};${firstName};;;`,
        );
      }
    }
    if (updates.email)
      vcard = this._updateVCardField(vcard, "EMAIL", updates.email);
    if (updates.phone)
      vcard = this._updateVCardField(vcard, "TEL", updates.phone);
    if (updates.organization)
      vcard = this._updateVCardField(vcard, "ORG", updates.organization);
    if (updates.title)
      vcard = this._updateVCardField(vcard, "TITLE", updates.title);
    if (updates.note)
      vcard = this._updateVCardField(vcard, "NOTE", updates.note);
    if (updates.bday)
      vcard = this._updateVCardField(vcard, "BDAY", updates.bday);
    if (updates.anniversary)
      vcard = this._updateVCardField(vcard, "ANNIVERSARY", updates.anniversary);
    if (updates.url) vcard = this._updateVCardField(vcard, "URL", updates.url);
    if (updates.role)
      vcard = this._updateVCardField(vcard, "ROLE", updates.role);
    if (updates.address) {
      const addrParts = updates.address.split("|");
      vcard = this._updateVCardField(vcard, "ADR", `;;${addrParts.join(";")}`);
    }

    await request(contact.href, {
      method: "PUT",
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "If-Match": contact.etag,
      },
      body: vcard,
    });

    return { uid, status: "updated" };
  },

  async delete(uid, addressBookName = null) {
    const contact = await this.findContactPath(uid, addressBookName);
    if (!contact) throw new Error(`Contact ${uid} not found.`);

    await request(contact.href, {
      method: "DELETE",
    });

    return { uid, status: "deleted" };
  },

  async search(query, addressBookName = null) {
    let addressBooks = await this.findAddressBooks();
    if (addressBookName) {
      const matched = matchByName(addressBooks, addressBookName);
      if (!matched) {
        const available =
          addressBooks.map((a) => a.displayname).join(", ") || "(none)";
        throw new Error(
          `Address book '${addressBookName}' not found. Available: ${available}`,
        );
      }
      addressBooks = [matched];
    }

    const allContacts = [];

    const body = `<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag />
    <card:address-data />
  </d:prop>
  <card:filter test="anyof">
    <card:prop-filter name="FN">
      <card:text-match collation="i;unicode-casemap" match-type="contains">${xmlEscape(query)}</card:text-match>
    </card:prop-filter>
    <card:prop-filter name="EMAIL">
      <card:text-match collation="i;unicode-casemap" match-type="contains">${xmlEscape(query)}</card:text-match>
    </card:prop-filter>
    <card:prop-filter name="TEL">
      <card:text-match collation="i;unicode-casemap" match-type="contains">${xmlEscape(query)}</card:text-match>
    </card:prop-filter>
    <card:prop-filter name="ORG">
      <card:text-match collation="i;unicode-casemap" match-type="contains">${xmlEscape(query)}</card:text-match>
    </card:prop-filter>
  </card:filter>
</card:addressbook-query>`;

    for (const ab of addressBooks) {
      try {
        const response = await request(ab.url, {
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

          const cardData = propstats[0]["d:prop"]["card:address-data"];
          if (!cardData) continue;

          const contact = this._parseVCard(cardData);
          contact.addressBook = ab.displayname;
          contact.href = r["d:href"];
          allContacts.push(contact);
        }
      } catch (e) {
        console.error("Address book error:", e.message);
      }
    }
    return allContacts;
  },
};
