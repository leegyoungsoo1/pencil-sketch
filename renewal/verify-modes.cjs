const assert=require('node:assert/strict');
module.exports=async({chromium,server})=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{const page=await browser.newPage();for(const route of ['classic.html','upgraded.html']){
 await page.goto(`http://127.0.0.1:${server.address().port}/${route}`);await page.waitForURL('**/atelier.html');assert.equal(await page.inputValue('#style'),'ai');assert.equal(await page.locator('#programMode').count(),0);
 }console.log('PASS: previous workshop URLs redirect to the unified atelier');}finally{await browser.close();server.close();}
};
