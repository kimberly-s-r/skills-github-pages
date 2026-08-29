/*
 * Resident roster — seeded from the "IR26 File Distributer ccisd-resident" sheet
 * (Drive ID 1a7nwVw_6-En1PauEwiwGfWSlsF3-zU3-UGOso4oO2-g), read 2026-08-27.
 *
 * TEA IDs are NOT carried in that sheet. Only Michelle Izarraras's TEA ID is known,
 * from her Appendix G packet. Every other resident's teaId is null, which the UI shows
 * as "not on file — enter manually" rather than inventing a number.
 *
 * KNOWN ROSTER DISCREPANCIES — surfaced, not silently fixed:
 *  - Mia Slusher and her host Kimberly Perez both report King HS; this sheet places
 *    them at Cunningham. One is wrong (flagged in the weekly pulse analysis, 8/18/26).
 *  - "Angelica Hecka" on this sheet answers pulse checks as "Angelica Delgado".
 *  - Zoe Garcia was reassigned after her host teacher's certification issue; her
 *    placement may have moved off this sheet.
 *  - No resident on this roster is placed at Baker MS, though Baker MS is a valid
 *    campus in the programme. The campus list below keeps Baker MS available.
 */

export const SCHOOLS = [
  { id: 'baker',      name: 'Baker MS',                     rosterKey: 'Baker' },
  { id: 'cunningham', name: 'Cunningham MS at South Park',  rosterKey: 'Cunningham' },
  { id: 'king',       name: 'King HS',                      rosterKey: 'King' },
  { id: 'ray',        name: 'W.B. Ray HS',                  rosterKey: 'Ray' },
];

export const SCHOOL_BY_ID = Object.fromEntries(SCHOOLS.map((s) => [s.id, s]));

export const RESIDENTS = [
  { name: 'Aiden Gonzales',     school: 'ray',        hostTeacher: 'Michelle Villarreal', teaId: null, driveFolderId: '1ZBewWLnXE7hvN-v4XTjP7fNssK0McyZu' },
  { name: 'Alex Acosta',        school: 'ray',        hostTeacher: 'Felix Hernandez',     teaId: null, driveFolderId: '1cWYGyC1n7ZwyWLC33gHWPhm9mpF6uMZ8' },
  { name: 'Angelica Hecka',     school: 'king',       hostTeacher: 'Steven Garcia',       teaId: null, driveFolderId: '1T3HcE9qCalizEanYj-gZlsxM25VLlapG',
    note: 'Answers pulse checks as "Angelica Delgado".' },
  { name: 'Angelina Petersen',  school: 'ray',        hostTeacher: 'Ana Aguilar Aguilar', teaId: null, driveFolderId: '14MQtGJhZIFaB2drFty_gsPcEPwvp-J5a' },
  { name: 'Ashley Amaro',       school: 'cunningham', hostTeacher: 'Sonya Banach',        teaId: null, driveFolderId: '1utxUwi25Fzmh_dA7zvDeCqwW22t3eamm' },
  { name: 'Christopher Garcia', school: 'king',       hostTeacher: 'Jaime Arredondo',     teaId: null, driveFolderId: '1dBmO0tLh7vWr04ecqSLTgci57c9Gvard' },
  { name: 'Gideon Perkins',     school: 'king',       hostTeacher: 'Juan Manuel Fiestas', teaId: null, driveFolderId: '1K3462vXnRfxrWqWBeSEj5Q_2wrHfthWG',
    note: 'Splits days with Adkins MS; reports to Adkins first each morning.' },
  { name: 'Jordan Salinas',     school: 'cunningham', hostTeacher: 'Jasmine Enriquez',    teaId: null, driveFolderId: '1-dQCDJ6dwV9Y09-C_1Yst7yXOxJIU0Pp' },
  { name: 'Kassandra Sandoval', school: 'king',       hostTeacher: 'Jennifer Parmenter',  teaId: null, driveFolderId: '1pk_494qfmsW8UlTRn_FoafCKp_vqKJ6X' },
  { name: 'Marina Munoz',       school: 'cunningham', hostTeacher: 'Michelle Hernandez',  teaId: null, driveFolderId: '1dkigazEJztntEuNNi6WaDA7kp3KDOXDg' },
  { name: 'Mia Slusher',        school: 'cunningham', hostTeacher: 'Kimberly Perez',      teaId: null, driveFolderId: '1S8OnsMUiWuIFkKv-uFZfzoYLxFcMyKBB',
    note: 'Campus disputed: resident and host both report King HS; roster says Cunningham.' },
  { name: 'Michelle Izarraras', school: 'cunningham', hostTeacher: 'Krista Montiel',      teaId: '2653142', driveFolderId: '1mqnJmGICMDzVPcE3A8BhzCuyZFQg6unb',
    note: 'TEA ID from her Appendix G packet. Pulse checks list her as "Michelle Llanas Izarraras".' },
  { name: 'Ren Perez',          school: 'king',       hostTeacher: 'Meredith Taylor',     teaId: null, driveFolderId: '1gvrxtkHs4AiMuSl9G8Og5Eg3dtD7wJCS' },
  { name: 'Stephen Nevares',    school: 'king',       hostTeacher: 'Ashley Tausch',       teaId: null, driveFolderId: '1BLc7Nt4694q4Yoz15gqD_VT5gzhj5cpj' },
  { name: 'Victoria Alaniz',    school: 'cunningham', hostTeacher: 'Daniel Cepeda',       teaId: null, driveFolderId: '1Sv73bV0Qa0eJw8FmgtKs9dSmvLE1xxYj' },
  { name: 'Zoe Garcia',         school: 'cunningham', hostTeacher: 'Melissa Salas',       teaId: null, driveFolderId: '1PROelzAlQSgkfWauuzcmigegZFQAGT1A',
    note: 'Reassigned after host teacher certification issue — confirm current placement before logging.' },
];

export function residentsAt(schoolId) {
  return RESIDENTS.filter((r) => r.school === schoolId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findResident(name) {
  return RESIDENTS.find((r) => r.name === name) || null;
}
