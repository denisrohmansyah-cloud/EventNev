# Participant Calendar Export — Test Checklist

- [ ] A participant with an approved registration sees “Simpan ke kalender”.
- [ ] Pending, rejected, and cancelled registrations do not show the calendar button.
- [ ] The generated .ics file includes event name, date, time, location, and description when available.
- [ ] Invalid or missing event dates produce a clear message and no file download.
- [ ] Event names/descriptions containing commas, semicolons, backslashes, and newlines are escaped for iCalendar.
- [ ] Times are interpreted as Western Indonesia Time (WIB, UTC+7).
- [ ] A time range crossing midnight produces an end date on the next day.
- [ ] Calendar export does not modify Google Sheets or make any network request.
- [ ] Existing cancel-registration controls continue to work.
- [ ] Verify import in Google Calendar, Outlook, and Apple Calendar before production rollout.
