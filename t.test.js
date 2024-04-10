const puppeteer = require('puppeteer');

describe('CVE Search Function', () => {
  test('User can search CVE by ID', async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('file:///Users/a1/Documents/CVE_Searching_Tool/index.html'); 

    await page.type('#search-box', 'CVE-1999-1234');
    await page.click('#search-btn');
    await page.waitForSelector('.search-result');
 
    const searchResult = await page.evaluate(() => document.querySelector('.search-result').textContent);
    expect(searchResult).toContain('CVE-1999-1234');

    await browser.close();
  });
});

describe('Paging Function', () => {
  test('User can navigate through search results pages', async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('file:///Users/a1/Documents/CVE_Searching_Tool/index.html');
        
    // 假设已经有搜索结果并且结果超过一页
    await page.click('#search-btn');
    await page.waitForSelector('.search-result');
    await page.click('#next-page'); // 点击“下一页”
    await page.waitForFunction(
    'document.querySelector("#current-page").textContent.includes("2")'
    );
        
    // 验证当前是否在第二页
    const currentPage = await page.evaluate(() => document.querySelector('#current-page').textContent);
    expect(currentPage).toBe('2');
        
    await browser.close();
  });
});



