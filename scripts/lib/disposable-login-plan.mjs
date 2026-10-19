// Disposable harness only: no connection, randomness, credential storage or execution.
const pattern = /^rc_it_[a-f0-9]{16}$/;
export function disposableLoginPlan(schema) {
 if (!pattern.test(schema)) throw Error('Generated disposable schema required');
 const login = schema + '_login', roles = [schema + '_reader', schema + '_writer'];
 const query = `SELECT r.rolname AS name,r.rolcanlogin AS login,r.rolinherit AS inherit,
 r.rolsuper AS superuser,r.rolbypassrls AS bypass,r.rolcreaterole AS creator,
 r.rolcreatedb AS database,r.rolreplication AS replication,
 EXISTS(SELECT 1 FROM pg_catalog.pg_shdepend d WHERE d.refclassid='pg_catalog.pg_authid'::pg_catalog.regclass AND d.refobjid=r.oid AND d.deptype='o') AS owner,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('role',p.rolname,'set',m.set_option,'inherit',m.inherit_option,'admin',m.admin_option) ORDER BY p.rolname)
 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles p ON p.oid=m.roleid WHERE m.member=r.oid),'[]'::jsonb) AS memberships
 FROM pg_catalog.pg_roles r WHERE r.rolname=$1::text`;
 return { login, roles, query, parameters: [login] };
}
export function inspectDisposableLogin(schema, rows) {
 const plan = disposableLoginPlan(schema), r = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
 if (!r || r.name !== plan.login || r.login !== true || ['inherit','superuser','bypass','creator','database','replication','owner'].some(k => r[k] !== false)) return false;
 if (!Array.isArray(r.memberships) || r.memberships.length !== 2) return false;
 return plan.roles.every(role => r.memberships.filter(m => m && m.role === role && m.set === true && m.inherit === false && m.admin === false).length === 1);
}
export function disposableLoginURL(adminURL, schema, password) {
 const { login } = disposableLoginPlan(schema), url = new URL(adminURL);
 if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || !/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(url.pathname.slice(1))) || !/^[a-f0-9]{64}$/.test(password)) throw Error('Local disposable URL and generated secret required');
 url.username = login; url.password = password; url.search = ''; url.hash = '';
 return url.toString();
}
