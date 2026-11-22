import assert from 'node:assert/strict';
import {prepareWebSmsAppointment} from '../lib/websms-appointment';

const when=new Date('2026-12-15T01:30:00Z');
const short=prepareWebSmsAppointment('Rimu',when);
assert.equal(short.date,'15/12');
assert.equal(short.time,'2:30pm');
assert.equal(short.text,'Your next appointment with Rimu is on 15/12 at 2:30pm. Std SMS charges apply.');
assert.equal(short.sendable,true);
assert.equal(short.segments,1);
const name='Te Whānau o Ngā Kaimahi Hair and Beauty Rotorua';
const long=prepareWebSmsAppointment(name,when);
assert.ok(long.text.includes(name)&&long.text.includes('15/12 at 2:30pm'));
assert.equal(long.encoding,'UCS-2');
assert.equal(long.segments,2);
assert.equal(long.sendable,true);
assert.equal(prepareWebSmsAppointment('Ā'.repeat(100),when).sendable,false);
console.log(JSON.stringify({short,long},null,2));
console.log('PASS: one- and two-part reminders retain the full name and time; longer reminders are refused.');
