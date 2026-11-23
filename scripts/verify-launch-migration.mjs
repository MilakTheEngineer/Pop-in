// Destructive schema rehearsal: only the isolated, freshly seeded QA database.
import './local-qa-guard.mjs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const migrate=pin=>spawnSync(process.execPath,['scripts/setup.mjs'],{env:{PATH:process.env.PATH,DATABASE_URL:process.env.DATABASE_URL,POPIN_ENVIRONMENT:'local',...(pin?{POPIN_PILOT_SHOP_ID:pin}:{})},encoding:'utf8'});
try{
 assert.equal((await db.query('SELECT count(*)::int AS n FROM shop_launch_approvals')).rows[0].n,0,'requires fresh QA approval table');
 assert.equal((await db.query("SELECT count(*)::int AS n FROM schema_migrations WHERE name IN ('060_owner_password_recovery','061_shop_launch_approval')")).rows[0].n,2);
 await db.query('DROP TABLE shop_launch_approvals');await db.query("DELETE FROM schema_migrations WHERE name='061_shop_launch_approval'");
 assert.notEqual(migrate('missing-fictional-shop').status,0);assert.equal((await db.query("SELECT to_regclass('shop_launch_approvals') AS table_name")).rows[0].table_name,null,'invalid pin rolls back schema too');
 assert.equal(migrate('rimu').status,0);assert.deepEqual((await db.query('SELECT shop_id,source,approved_by FROM shop_launch_approvals')).rows,[{shop_id:'rimu',source:'legacy_pin',approved_by:null}]);
 assert.equal(migrate('a-different-pin').status,0);assert.deepEqual((await db.query('SELECT shop_id FROM shop_launch_approvals')).rows,[{shop_id:'rimu'}]);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM schema_migrations WHERE name='061_shop_launch_approval'")).rows[0].n,1);
 await db.query("DELETE FROM shop_launch_approvals WHERE shop_id='rimu'");
 console.log('PASS: migrations 060/061 present; invalid legacy pin rolls back atomically; existing pilot imported once; repeat migration with changed pin neither revokes nor approves shops.');
}finally{await db.end()}
