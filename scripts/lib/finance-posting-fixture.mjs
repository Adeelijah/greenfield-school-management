import {financeStorageFixturePlan} from './finance-storage-fixture.mjs';

// Exact generated schema/roles only. The trusted fixture caller supplies an auth UUID.
export function financePostingFixturePlan(schema){
 const storage=financeStorageFixturePlan(schema),q='"'+schema+'"',t=name=>q+'."'+name+'"';
 const roles={owner:schema+'_owner',worker:schema+'_worker',login:schema+'_login'};
 const owner='"'+roles.owner+'"',worker='"'+roles.worker+'"',login='"'+roles.login+'"';
 const gate=`pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('${schema}:finance-fixture',0))`;
 const parents=['schools','school_users','memberships','academic_sessions','terms','classes','students','enrollments'];
 const relations=[...parents,...storage.financeRelations];
 const post=`CREATE FUNCTION ${t('post_finance')}(verified_auth uuid,cmd jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $post$
 DECLARE
  v_action text; v_keys text[]; v_expected integer; v_key text; v_invoice uuid;
  v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date;
  v_date date; v_method text; v_reference text; v_amount bigint; v_paid numeric;
  v_payment uuid; v_receipt uuid; v_reversal uuid; v_audit uuid; v_outcome jsonb;
  actor record; invoice record; original record; previous record;
 BEGIN
  IF session_user<>'${roles.login}' OR current_setting('role')<>'${roles.worker}' OR current_setting('transaction_isolation')<>'read committed' THEN RETURN '{"ok":false,"code":"forbidden"}'; END IF;
  IF cmd IS NULL OR jsonb_typeof(cmd)<>'object' THEN RETURN '{"ok":false,"code":"invalid"}'; END IF;
  v_action:=cmd->>'action';
  IF v_action IS NULL OR v_action NOT IN ('record_payment','reverse_payment') THEN RETURN '{"ok":false,"code":"invalid"}'; END IF;
  v_keys:=ARRAY['action','invoiceId','expectedVersion','operationKey'] || CASE WHEN v_action='record_payment' THEN ARRAY['amount','method','reference','receivedOn'] ELSE ARRAY['paymentId','reason'] END;
  IF NOT (cmd ?& v_keys) OR cmd-v_keys<>'{}'::jsonb OR jsonb_typeof(cmd->'invoiceId')<>'string' OR cmd->>'invoiceId' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' OR jsonb_typeof(cmd->'operationKey')<>'string' OR cmd->>'operationKey' !~ '^[A-Za-z0-9:_-]{8,120}$' OR jsonb_typeof(cmd->'expectedVersion')<>'number' OR cmd->>'expectedVersion' !~ '^[1-9][0-9]{0,9}$' THEN RETURN '{"ok":false,"code":"invalid"}'; END IF;
  IF (cmd->>'expectedVersion')::bigint>2147483646 THEN RETURN '{"ok":false,"code":"invalid"}'; END IF;
  v_expected:=(cmd->>'expectedVersion')::integer; v_invoice:=(cmd->>'invoiceId')::uuid; v_key:=cmd->>'operationKey';
  IF v_action='record_payment' THEN
   v_method:=cmd->>'method'; v_reference:=cmd->>'reference';
   IF jsonb_typeof(cmd->'amount')<>'string' OR cmd->>'amount' !~ '^(0|[1-9][0-9]{0,9})[.][0-9]{2}$' OR v_method IS NULL OR v_method NOT IN ('cash','bank_transfer','pos') OR jsonb_typeof(cmd->'reference') NOT IN ('null','string') OR (v_method<>'cash' AND v_reference IS NULL) OR (v_reference IS NOT NULL AND v_reference !~ '^[A-Za-z0-9][A-Za-z0-9:/_.-]{0,99}$') OR jsonb_typeof(cmd->'receivedOn')<>'string' OR cmd->>'receivedOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN '{"ok":false,"code":"invalid"}'; END IF;
   v_amount:=((cmd->>'amount')::numeric*100)::bigint;
   IF v_amount NOT BETWEEN 1 AND 999999999999 THEN RETURN '{"ok":false,"code":"invalid"}'; END IF;
   BEGIN v_date:=(cmd->>'receivedOn')::date; EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN '{"ok":false,"code":"invalid"}'; END;
   IF to_char(v_date,'YYYY-MM-DD')<>cmd->>'receivedOn' THEN RETURN '{"ok":false,"code":"invalid"}'; END IF;
  ELSE
   IF jsonb_typeof(cmd->'paymentId')<>'string' OR cmd->>'paymentId' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' OR jsonb_typeof(cmd->'reason')<>'string' OR length(cmd->>'reason') NOT BETWEEN 3 AND 2000 OR btrim(cmd->>'reason')<>cmd->>'reason' THEN RETURN '{"ok":false,"code":"invalid"}'; END IF;
   v_payment:=(cmd->>'paymentId')::uuid;
  END IF;

  PERFORM ${gate};
  IF (SELECT count(*) FROM ${t('school_users')} u WHERE u.auth_user_id=verified_auth)<>1 OR (SELECT count(*) FROM ${t('memberships')} m JOIN ${t('school_users')} u ON u.id=m.user_id WHERE u.auth_user_id=verified_auth AND m.status='active')<>1 THEN RETURN '{"ok":false,"code":"forbidden"}'; END IF;
  SELECT m.id,m.school_id,m.role INTO actor FROM ${t('memberships')} m JOIN ${t('school_users')} u ON u.id=m.user_id WHERE u.auth_user_id=verified_auth AND m.status='active';
  IF actor.role NOT IN ('admin','bursar') OR (v_action='reverse_payment' AND actor.role<>'admin') THEN RETURN '{"ok":false,"code":"forbidden"}'; END IF;
  SELECT i.* INTO invoice FROM ${t('finance_invoices')} i WHERE i.school_id=actor.school_id AND i.id=v_invoice FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"forbidden"}'; END IF;
  SELECT o.command,o.outcome INTO previous FROM ${t('finance_operation_receipts')} o WHERE o.school_id=actor.school_id AND o.actor_id=actor.id AND o.operation_key=v_key;
  IF FOUND THEN
   IF previous.command IS DISTINCT FROM cmd THEN RETURN '{"ok":false,"code":"conflict"}'; END IF;
   RETURN jsonb_build_object('ok',true,'kind','replay','result',previous.outcome);
  END IF;
  IF invoice.version<>v_expected OR v_expected>=2147483646 THEN RETURN '{"ok":false,"code":"conflict"}'; END IF;

  IF v_action='record_payment' THEN
   IF v_date<invoice.issued_on OR v_date>v_today THEN RETURN '{"ok":false,"code":"invalid"}'; END IF;
   SELECT COALESCE(sum(amount_kobo),0) INTO v_paid FROM ${t('finance_payments')} p WHERE p.school_id=actor.school_id AND p.invoice_id=v_invoice;
   v_paid:=v_paid-(SELECT COALESCE(sum(amount_kobo),0) FROM ${t('finance_reversals')} r WHERE r.school_id=actor.school_id AND r.invoice_id=v_invoice);
   IF v_paid<0 OR v_paid>invoice.total_kobo THEN RETURN '{"ok":false,"code":"invalid_history"}'; END IF;
   IF v_amount>invoice.total_kobo-v_paid THEN RETURN '{"ok":false,"code":"overpayment"}'; END IF;
   IF v_reference IS NOT NULL AND EXISTS(SELECT 1 FROM ${t('finance_payments')} p WHERE p.school_id=actor.school_id AND p.method=v_method AND p.reference=v_reference) THEN RETURN '{"ok":false,"code":"duplicate_reference"}'; END IF;
   v_payment:=gen_random_uuid(); v_receipt:=gen_random_uuid();
   INSERT INTO ${t('finance_payments')}(id,school_id,invoice_id,amount_kobo,method,reference,received_on,recorded_by,posted_version) VALUES(v_payment,actor.school_id,v_invoice,v_amount,v_method,v_reference,v_date,actor.id,v_expected+1);
   INSERT INTO ${t('finance_receipts')}(id,school_id,invoice_id,payment_id,amount_kobo,currency) VALUES(v_receipt,actor.school_id,v_invoice,v_payment,v_amount,'NGN');
  ELSE
   SELECT p.amount_kobo,r.id AS original_receipt INTO original FROM ${t('finance_payments')} p JOIN ${t('finance_receipts')} r ON r.school_id=p.school_id AND r.payment_id=p.id WHERE p.school_id=actor.school_id AND p.invoice_id=v_invoice AND p.id=v_payment;
   IF NOT FOUND OR EXISTS(SELECT 1 FROM ${t('finance_reversals')} r WHERE r.school_id=actor.school_id AND r.payment_id=v_payment) THEN RETURN '{"ok":false,"code":"conflict"}'; END IF;
   v_reversal:=gen_random_uuid(); v_receipt:=original.original_receipt;
   INSERT INTO ${t('finance_reversals')}(id,school_id,invoice_id,payment_id,receipt_id,amount_kobo,reason,recorded_by,posted_version) VALUES(v_reversal,actor.school_id,v_invoice,v_payment,v_receipt,original.amount_kobo,cmd->>'reason',actor.id,v_expected+1);
  END IF;
  UPDATE ${t('finance_invoices')} SET version=v_expected+1 WHERE school_id=actor.school_id AND id=v_invoice AND version=v_expected;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finance version changed while posting'; END IF;
  v_audit:=gen_random_uuid();
  INSERT INTO ${t('finance_audit')}(id,school_id,invoice_id,actor_id,action,before_version,after_version,payment_id,receipt_id,reversal_id,payment_version) VALUES(v_audit,actor.school_id,v_invoice,actor.id,v_action,v_expected,v_expected+1,v_payment,v_receipt,v_reversal,CASE WHEN v_action='record_payment' THEN v_expected+1 ELSE NULL END);
  v_outcome:=jsonb_build_object('ok',true,'action',v_action,'invoiceId',v_invoice,'version',v_expected+1,'eventId',COALESCE(v_reversal,v_payment),'receiptId',CASE WHEN v_action='record_payment' THEN v_receipt ELSE NULL END);
  INSERT INTO ${t('finance_operation_receipts')}(school_id,actor_id,operation_key,command,audit_id,invoice_id,version,outcome) VALUES(actor.school_id,actor.id,v_key,cmd,v_audit,v_invoice,v_expected+1,v_outcome);
  RETURN jsonb_build_object('ok',true,'kind','applied','result',v_outcome);
 END $post$`;
 const functions=[
  `CREATE FUNCTION ${t('lock_finance_discovery')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $gate$ BEGIN PERFORM ${gate}; RETURN NULL; END $gate$`,post,
  `ALTER FUNCTION ${t('check_finance_storage')}() SECURITY DEFINER`,
  `ALTER FUNCTION ${t('check_finance_storage')}() OWNER TO ${owner}`,
  `ALTER FUNCTION ${t('post_finance')}(uuid,jsonb) OWNER TO ${owner}`,
 ];
 const security=[
  ...relations.flatMap(name=>[
   `ALTER TABLE ${t(name)} ENABLE ROW LEVEL SECURITY`,
   `ALTER TABLE ${t(name)} FORCE ROW LEVEL SECURITY`,
   `CREATE POLICY finance_private_owner ON ${t(name)} TO ${owner} USING (true) WITH CHECK (true)`,
   `CREATE TRIGGER finance_discovery BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${t(name)} FOR EACH STATEMENT EXECUTE FUNCTION ${t('lock_finance_discovery')}()`,
  ]),
  `REVOKE ALL ON SCHEMA ${q} FROM PUBLIC`,
  `REVOKE ALL ON ALL TABLES IN SCHEMA ${q} FROM PUBLIC,${worker},${login}`,
  `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${q} FROM PUBLIC,${worker},${login}`,
  `GRANT USAGE ON SCHEMA ${q} TO ${owner},${worker}`,
  `GRANT SELECT ON ALL TABLES IN SCHEMA ${q} TO ${owner}`,
  `GRANT INSERT ON ${['finance_payments','finance_receipts','finance_reversals','finance_audit','finance_operation_receipts'].map(t).join(',')} TO ${owner}`,
  `GRANT UPDATE(version) ON ${t('finance_invoices')} TO ${owner}`,
  `GRANT EXECUTE ON FUNCTION ${t('post_finance')}(uuid,jsonb) TO ${worker}`,
 ];
 return {storage,roles,relations,post,statements:[...functions,...security]};
}
