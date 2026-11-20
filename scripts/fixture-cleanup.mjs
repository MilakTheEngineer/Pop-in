// Only remove test-generated profiles after their fixture appointments are gone.
export async function clearFixtureProfiles(db,entryIds){if(!entryIds.length)return;const ids=entryIds.map(id=>'booking:'+id);await db.query('DELETE FROM clients c WHERE c.id=ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM schedule_entries e WHERE e.client_id=c.id)',[ids]);}
