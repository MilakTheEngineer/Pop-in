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
assert.ok(long.text.includes('Te Whanau o Nga Kaimahi Hair and Beauty Rotorua')&&long.text.includes('15/12 at 2:30pm'));
assert.equal(long.encoding,'GSM-7');
assert.equal(long.segments,1);
assert.equal(long.sendable,true);
assert.equal(prepareWebSmsAppointment('Ā'.repeat(300),when).sendable,false);
console.log(JSON.stringify({short,long},null,2));
console.log('PASS: macrons become their base letters; reminders retain the full name and time.');
