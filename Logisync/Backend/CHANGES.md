# Mga idinagdag sa backend (walang binago sa dating verification/video/message logic)

## KAILANGAN MUNA: patakbuhin ang `database/migration-v2.sql` (isang beses lang)
phpMyAdmin -> piliin ang `synclink_db` -> tab **SQL** -> i-paste ang laman ng file -> Go.
Nagdadagdag ito ng delivery columns sa `parcels` at ng bagong table na `audit_logs`.
Kung wala pa ang `transaction_number` column sa parcels, idagdag muna (nasa itaas ng file ang command).

## Bagong endpoints
| Endpoint | Sino | Para saan |
|---|---|---|
| GET /api/parcels | seller (sarili), coordinator (lahat) | listahan; kasama na ang delivery_status, rider_name |
| GET /api/parcels/by-transaction/:txn | seller (sarili), coordinator, rider | hanapin gamit ang transaction number |
| GET /api/users/contacts | lahat | sino ang pwedeng i-message |
| GET /api/users?role= | coordinator | listahan ng accounts |
| POST /api/users | coordinator | gumawa ng account (seller / rider / coordinator) |
| POST /api/auth/register | coordinator | pareho ng POST /api/users. WALA NANG PUBLIC SIGN-UP |
| POST /api/parcels/rider/:id/scan | rider | VERIFIED na parcel -> TO_DELIVER (siya na ang may hawak) |
| POST /api/parcels/rider/:id/delivered | rider | TO_DELIVER -> DELIVERED (note optional) |
| POST /api/parcels/rider/:id/failed | rider | TO_DELIVER -> FAILED (reason required) |
| GET /api/parcels/rider/mine | rider | mga parcel na na-scan niya |
| GET /api/audit-logs?limit&offset&category&q | lahat (naka-filter ayon sa role) | audit log at recent activity |

## Sino ang nakakakita ng audit log
- coordinator: lahat
- seller: mga ginawa niya + mga nangyari sa sarili niyang parcel
- rider: mga ginawa niya + mga nangyari sa parcel na hawak niya

## Ano ang nilolog
Registered parcel, Uploaded video proof, Verified / Rejected / Requested reupload, Scanned parcel for delivery,
Delivered parcel, Failed delivery, Retrying delivery, Created account.
Kapag pumalya ang pagsulat sa audit_logs, hindi nasisira ang pangunahing gawain (nagpi-print lang ng babala sa terminal).

## Files
Bago: `database/migration-v2.sql`, `src/utils/audit.js`, `src/controllers/auditController.js`, `src/routes/auditRoutes.js`,
`src/controllers/userController.js`, `src/routes/userRoutes.js`.
Binago: `src/app.js`, `src/controllers/parcelController.js`, `src/routes/parcelRoutes.js`, `src/routes/authRoutes.js`.
Ang `register()` sa authController.js ay hindi na ginagamit (iniwan lang).

## Paalala
- Ang bagong accounts ay kailangan ng password na hindi bababa sa 8 characters (ang dating register ay 6).
- Ang delivery proof (larawan) ay hindi ipinapadala sa backend; nananatili ito sa device ng rider.
