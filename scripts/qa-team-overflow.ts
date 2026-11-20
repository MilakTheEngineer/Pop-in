import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
try{
 await page.goto('http://127.0.0.1:3003/login');await page.getByLabel('Email').fill('qa-owner@example.test');await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Sign in'}).click();await page.waitForURL('**/today');await page.goto('http://127.0.0.1:3003/team');await page.waitForLoadState('networkidle');
 const metrics=await page.evaluate(()=>({viewport:innerWidth,visual:visualViewport?.width,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,overflow:[...document.querySelectorAll<HTMLElement>('body *')].map(e=>({tag:e.tagName,cls:e.className,scroll:e.scrollWidth,client:e.clientWidth,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,css:getComputedStyle(e).overflowX,text:(e.innerText||'').slice(0,100)})).filter(e=>e.right>innerWidth+0.5&&e.css!=='auto'&&e.css!=='scroll').slice(0,20)}));console.log(JSON.stringify(metrics,null,2));
 await page.screenshot({path:'artifacts/qa-20261121/team-overflow-debug.png',fullPage:true});
}finally{await browser.close()}
