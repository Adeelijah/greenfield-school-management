// Adapts reviewed function bodies for generated fixtures only; executes no SQL.
export function completeFixtureAuthorityDDL(schema, proposal) {
  if (!/^rc_it_[a-f0-9]{16}$/.test(schema)) throw Error('Generated fixture schema required');
  const table=name=>'"'+schema+'"."'+name+'"';
  const owner=schema+'_authority_owner', qOwner='"'+owner+'"';
  const writer='"'+schema+'_writer"',reader='"'+schema+'_reader"';
  const source=typeof proposal==='string'?proposal.replace(/\r\n/g,'\n'):'';
  const extract=(name,signature)=>{
    const start=source.indexOf('CREATE FUNCTION public.'+name+'(');
    const end=source.indexOf('ALTER FUNCTION public.'+signature,start);
    if(start<0||end<=start)throw Error('Reviewed authority function missing');
    return source.slice(start,end).replaceAll('public.','"'+schema+'".').trim();
  };
  let lock=extract('lock_report_card_actor','lock_report_card_actor(uuid)');
  let gate=extract('lock_report_card_authority_write_gate','lock_report_card_authority_write_gate()');
  const shared="  PERFORM pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1', 0));";
  const exclusive="  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1', 0));";
  if(!lock.includes(shared)||!gate.includes(exclusive))throw Error('Reviewed authority gate contract missing');
  lock=lock.replace(shared,'  PERFORM id FROM '+table('fixture_source_write_gate')+' WHERE id=1 FOR SHARE;\n  IF NOT FOUND THEN RAISE EXCEPTION \'missing fixture source gate\'; END IF;\n'+shared);
  gate=gate.replace(exclusive,'  PERFORM id FROM '+table('fixture_source_write_gate')+' WHERE id=1 FOR UPDATE;\n  IF NOT FOUND THEN RAISE EXCEPTION \'missing fixture source gate\'; END IF;\n'+exclusive);
  const statements=[
    'CREATE ROLE '+qOwner+' NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION',
    'GRANT USAGE ON SCHEMA "'+schema+'" TO '+qOwner,
  ];
  for(const name of ['school_users','memberships','schools','fixture_source_write_gate']) {
    statements.push('GRANT SELECT, UPDATE(id) ON '+table(name)+' TO '+qOwner);
    statements.push('CREATE POLICY fixture_complete_authority_read ON '+table(name)+' FOR SELECT TO '+qOwner+' USING (true)');
    statements.push('CREATE POLICY fixture_complete_authority_lock ON '+table(name)+' FOR UPDATE TO '+qOwner+' USING (true) WITH CHECK (false)');
  }
  for(const [definition,name,signature] of [[lock,'lock_report_card_actor','uuid'],[gate,'lock_report_card_authority_write_gate','']]) {
    statements.push(definition,'ALTER FUNCTION '+table(name)+'('+signature+') OWNER TO '+qOwner,
      'REVOKE ALL ON FUNCTION '+table(name)+'('+signature+') FROM PUBLIC,'+writer+','+reader);
  }
  statements.push('GRANT EXECUTE ON FUNCTION '+table('lock_report_card_actor')+'(uuid) TO '+writer);
  for(const name of ['school_users','memberships','schools','teacher_class_assignments'])statements.push('CREATE TRIGGER fixture_complete_authority_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON '+table(name)+' FOR EACH STATEMENT EXECUTE FUNCTION '+table('lock_report_card_authority_write_gate')+'()');
  return {owner,statements};
}
