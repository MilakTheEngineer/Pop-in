import {chromium,webkit} from 'playwright';

// The same customer/staff checks can run in either engine without a parallel suite.
export function launchQaBrowser(){
 const engine=process.env.QA_BROWSER||'chromium';
 if(engine==='webkit'){console.log('QA browser: WebKit (local emulation)');return webkit.launch({headless:true});}
 if(engine!=='chromium')throw new Error('QA_BROWSER must be chromium or webkit.');
 return chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium')});
}
