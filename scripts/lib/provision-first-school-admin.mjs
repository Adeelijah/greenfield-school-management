// Prepared operator-only transaction. NOT wired to any executable command or route.
// Do not call until reviewed migrations, privileges, RLS and integration tests pass.
// Requires a trusted, operator-controlled Postgres connection with transaction support.
export async function provisionFirstSchoolAdmin(sql, input) {
  const { authUserId, schoolSlug, schoolName, displayName } = input;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authUserId ?? '')) {
    throw new Error('Invalid Supabase Auth user ID');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(schoolSlug ?? '') || schoolSlug.length > 80 ||
      !schoolName?.trim() || schoolName.length > 180 ||
      !displayName?.trim() || displayName.length > 160) {
    throw new Error('Invalid school or administrator details');
  }
  if (typeof sql?.begin !== 'function') throw new Error('Transaction-capable database client required');

  // A unique school slug, unique auth_user_id and unique school membership
  // remain essential DB constraints against concurrent duplicate attempts.
  return sql.begin(async (tx) => {
    const [identity] = await tx`
      SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = ${authUserId}::uuid) AS exists
    `;
    if (!identity?.exists) throw new Error('Supabase Auth account does not exist');

    const [alreadyLinked] = await tx`
      SELECT EXISTS(
        SELECT 1 FROM public.school_users WHERE auth_user_id = ${authUserId}::uuid
      ) AS exists
    `;
    if (alreadyLinked?.exists) throw new Error('Auth account already provisioned');

    const [school] = await tx`
      INSERT INTO public.schools (name, slug)
      VALUES (${schoolName.trim()}, ${schoolSlug})
      RETURNING id
    `;
    const [user] = await tx`
      INSERT INTO public.school_users (auth_user_id, display_name)
      VALUES (${authUserId}::uuid, ${displayName.trim()})
      RETURNING id
    `;
    await tx`
      INSERT INTO public.memberships (school_id, user_id, role, status)
      VALUES (${school.id}::uuid, ${user.id}::uuid, 'admin', 'active')
    `;
    await tx`
      INSERT INTO public.audit_events (school_id, actor_user_id, action, entity_type, entity_id)
      VALUES (${school.id}::uuid, ${user.id}::uuid, 'school.bootstrap', 'school', ${school.id}::uuid)
    `;
    return { schoolId: school.id, schoolUserId: user.id };
  });
}
