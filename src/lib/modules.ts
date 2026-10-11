export const moduleGroups = [
 {title:'OVERVIEW',items:['Dashboard']},
 {title:'PEOPLE',items:['Students','Admissions','Guardians','Staff']},
 {title:'ACADEMICS',items:['Classes','Subjects','Attendance','Assessments','Results']},
 {title:'FINANCE',items:['Fee Structures','Invoices','Payments','Receipts']},
 {title:'REPORTS',items:['Academic Reports','Attendance Reports','Financial Reports']},
 {title:'ADMINISTRATION',items:['School Settings','Academic Calendar','Users & Permissions']}
] as const;
export const moduleNames=moduleGroups.flatMap(g=>g.items);
export type ModuleName=(typeof moduleNames)[number];
export function slugFor(name:string){return name.toLowerCase().replace(/ & /g,'-and-').replace(/ /g,'-')}
export function findModule(slug:string){return moduleNames.find(name=>slugFor(name)===slug)}
export const moduleDescriptions:Record<string,string>={
 Students:'Manage pupil records, enrolment and class assignments.',
 Admissions:'Review and process applications for admission.',
 Guardians:'Maintain parent and guardian contact information.',
 Staff:'Manage staff profiles, roles and assignments.',
 Classes:'Organize classes, sections and class teachers.',
 Subjects:'Manage the school subject catalogue.',
 Attendance:'Review and record daily attendance.',
 Assessments:'Manage continuous assessments and examinations.',
 Results:'Review, approve and publish academic results.',
 'Fee Structures':'Configure fees by academic session and class.',
 Invoices:'Review student invoices and outstanding balances.',
 Payments:'Record and reconcile payments received.',
 Receipts:'View and print payment receipts.',
 'Academic Reports':'Explore academic performance by class and term.',
 'Attendance Reports':'Review attendance patterns and exceptions.',
 'Financial Reports':'Summarize collections, invoices and balances.',
 'School Settings':'Manage school details and academic defaults.',
 'Academic Calendar':'Plan school events, holidays and term dates.',
 'Users & Permissions':'Manage staff access and school roles.'
};
