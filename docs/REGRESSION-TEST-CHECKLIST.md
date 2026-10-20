# EventNev — Regression & Release Checklist

This checklist is for validating the registration/profile improvements against a **test copy** of the Google Spreadsheet and a test Apps Script deployment. Do not test destructive actions against production participant data.

## Automated checks already performed
- JavaScript syntax parse for `Code.gs`, `admin.js`, and `dashboard.js`.
- Source checks that registration saves academic fields using the current sheet headers.
- Source checks that profile updates validate participant type from the authenticated server-side account.
- Source checks that the dashboard HTML uses a cache-busted script version.

## Registration tests
- [ ] Register a unique participant with type Mahasiswa and complete Universitas, NIM, Angkatan, Program Studi, and Fakultas.
- [ ] Verify those fields are persisted in the Users sheet, including compatibility aliases when those columns exist.
- [ ] Register a unique participant with type Siswa and complete Sekolah, NISN, Angkatan, and Jurusan.
- [ ] Register a participant with type Umum and verify academic fields may remain blank.
- [ ] Attempt duplicate registration using the same email with different letter casing; expect rejection.
- [ ] Attempt incomplete Mahasiswa and Siswa registration directly against the API; expect rejection.
- [ ] Attempt invalid email, overly long name, missing phone, and password shorter than 8 characters; expect rejection.
- [ ] Submit two simultaneous registration requests for the same email; only one account should be created.

## Participant profile tests
- [ ] Login as each participant type and confirm stored academic fields load into the profile form.
- [ ] Update profile fields and verify the Users sheet reflects the changes.
- [ ] Submit incomplete academic fields; expect a validation message and no partial update.
- [ ] Verify an authenticated participant cannot update another account by changing `userId` in the request body.
- [ ] Verify older accounts without academic columns can still log in and update basic profile data.

## Admin and event integrity tests
- [ ] Confirm Admin can view participant identity, NIM/NISN, and institution fields where available.
- [ ] Confirm duplicate registrations are rejected for legacy records stored using email or event name.
- [ ] Confirm quota checks include eligible legacy registrations and exclude cancelled/rejected records.
- [ ] Confirm event/application/certificate history cannot be deleted through the admin interface where protections apply.

## Document privacy tests
- [ ] Upload a new certificate and verify it is not shared using `Anyone with the link`.
- [ ] Download it as the assigned participant and as an authenticated Admin.
- [ ] Try downloading another participant's certificate; expect access denied.
- [ ] Upload a requirement photo and try using its ID for a different user or event; expect rejection.
- [ ] Review old Drive files separately; new-folder isolation does not revoke permissions on existing files.

## Release gates
- [ ] Review changes in pull request before merge.
- [ ] Deploy Apps Script only after explicit approval and testing.
- [ ] After deployment, test login, registration, profile update, event registration/cancellation, attendance, certificate upload/download, and mobile layouts.
- [ ] Keep a backup of the spreadsheet and current Apps Script deployment before production rollout.
