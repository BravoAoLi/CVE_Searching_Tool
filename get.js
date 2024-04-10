// 缓存jQuery选择器
const searchBox = $('#search-box');
const severityFilter = $('#severityFilter');
const searchSuggestions = $('#search-suggestions');
const searchBtn = $('#search-btn');
const searchMethodFilter = $('#searchMethodFilter');

// 关闭模态框
$('.close').on("click", function() {
  $('.modal').hide(1000, "linear");
});

// 预加载数据
$.ajax({
  url: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
  method: 'GET',
  dataType: 'json',
}).done(function(preloadedData) {
  window.preloadedData = preloadedData;

  // 绑定搜索框输入事件
  searchBox.on('input', function() {
    searchSuggestions.empty();
    searchSuggestions.show();

    const inputValue = this.value.trim().toLowerCase();
    const selectedSearchMethod = searchMethodFilter.val();
    
    let filteredData;
    switch (selectedSearchMethod) {
      case 'cveid':
        filteredData = preloadedData.vulnerabilities.filter(vuln => vuln.cve && vuln.cve.id.toLowerCase().includes(inputValue));
        break;
      case 'keyword':
        filteredData = preloadedData.vulnerabilities.filter(vuln => vuln.cve.descriptions.some(description => description.lang === 'en' && description.value.toLowerCase().includes(inputValue)));
        break;
      case 'cpe':
        filteredData = preloadedData.vulnerabilities.filter(vuln => {
          const configurations = vuln.cve.configurations;
          if (!configurations) return false;
          const nodes = configurations[0]?.nodes;
          if (!nodes) return false;
          const cpeMatches = nodes[0]?.cpeMatch;
          if (!cpeMatches) return false;
          return cpeMatches.some(match => match.criteria.toLowerCase().includes(inputValue));
        });
        break;
      default:
        filteredData = [];
    }

    // 显示搜索建议
    let suggestionCount = 0;
    $.each(filteredData, function(index, item) {
      if (suggestionCount >= 12) return false;
      
      let suggestionText;
      switch (selectedSearchMethod) {
        case 'cveid':
          suggestionText = item.cve.id;
          break;
        case 'keyword':
          suggestionText = item.cve.descriptions.find(description => description.lang === 'en' && description.value.toLowerCase().includes(inputValue))?.value;
          break;
        case 'cpe':
          const configNodes = item.cve.configurations[0]?.nodes[0]?.cpeMatch;
          const matchedCpe = configNodes.find(match => match.criteria.toLowerCase().includes(inputValue));
          suggestionText = matchedCpe ? matchedCpe.criteria : '';
          break;
      }

      const suggestionItem = $('<div>', {
        text: suggestionText,
        'class': 'search-suggestion-item',
      });
      suggestionItem.on("click", function() {
        searchBox.val(suggestionText);
        searchSuggestions.hide();
      });
      searchSuggestions.append(suggestionItem);
      suggestionCount++;
    });

    // 失去焦点时隐藏建议
    searchBox.on('blur', function() {
      setTimeout(() => searchSuggestions.hide(), 200);
    });

    // 搜索方法切换时触发输入事件
    searchMethodFilter.on("change", function() {
      searchBox.trigger('input');
    });
  });

  // 请求失败时的错误处理
}).fail(function(jqXHR, textStatus, errorThrown) {
  console.error('Error loading data:', textStatus, ', Details:', errorThrown);
});

// 搜索按钮点击事件
searchBtn.on("click", function() {
  const inputValue = searchBox.val().trim();
  const selectedSearchMethod = searchMethodFilter.val();
  let apiUrl;
  
  // 根据搜索方法设置API URL
  switch (selectedSearchMethod) {
    case 'cveid':
      apiUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=' + inputValue;
      break;
    case 'keyword':
      apiUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=' + inputValue;
      break;
    case 'cpe':
      apiUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0?cpeName=' + inputValue;
      break;
  }

  // 发起新的搜索请求
  $.ajax({
    url: apiUrl,
    method: 'GET',
    dataType: 'json',
  }).done(function(searchedData) {
    window.data = searchedData;
    const initialSearchData = searchedData;
    const searchResultsContainer = $('#search-results-container').empty();
    let currentPage = 1;
    const itemsPerPage = 15;
    let totalPages = calculateTotalPages(searchedData.vulnerabilities.length, itemsPerPage);
    $('#total-pages').text(totalPages);

    // 渲染初始搜索结果页面
    renderCurrentPage(searchedData, currentPage, itemsPerPage, selectedSearchMethod);

    // 分页按钮点击事件
    $('#prev-page, #next-page').on("click", function() {
      const isPrev = this.id === 'prev-page';
      currentPage = isPrev ? currentPage - 1 : currentPage + 1;
    
      // 添加边界判断
      currentPage = Math.max(1, currentPage); // 最小值为1
      currentPage = Math.min(totalPages, currentPage); // 最大值为总页数
    
      renderCurrentPage(searchedData, currentPage, itemsPerPage, selectedSearchMethod);
    });

    
    // 日期筛选事件
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    startDateInput.addEventListener('change', function() {
      if (this.value === '') {
        searchedData = initialSearchData;
        currentPage = 1;
        totalPages = calculateTotalPages(searchedData.vulnerabilities.length, itemsPerPage);
        $('#total-pages').text(totalPages);
        renderCurrentPage(searchedData, 1, itemsPerPage,selectedSearchMethod);
      } else {
		applyDateFilter(startDateInput, endDateInput);
		currentPage = 1; // 设置当前页为第一页
		renderCurrentPage(searchedData, 1, itemsPerPage,electedSearchMethod); // 更改为调用第一页
      }
    });
    endDateInput.addEventListener('change', function() {
      if (startDateInput.value === '' || this.value === '') {
        startDateInput.dispatchEvent(new Event('change'));
      } else {
        applyDateFilter(startDateInput, endDateInput);
        currentPage = 1; // 设置当前页为第一页
        renderCurrentPage(searchedData, 1, itemsPerPage,electedSearchMethod); // 更改为调用第一页
      }
    });

    // 应用日期筛选
    
    function applyDateFilter(startDateInput, endDateInput) {
      const startDate = new Date(startDateInput.value);
      const endDate = new Date(endDateInput.value);	
	  
      const filteredData = initialSearchData.vulnerabilities.filter(vuln => {
        const modifiedDate = new Date(vuln.cve.lastModified);
        return modifiedDate >= startDate && modifiedDate <= endDate;
      });
    
      searchedData = { vulnerabilities: filteredData };
      totalPages = calculateTotalPages(filteredData.length, itemsPerPage);
	  
      $('#total-pages').text(totalPages);
      renderCurrentPage(searchedData, currentPage, itemsPerPage, selectedSearchMethod);
    }
  }).fail(function(jqXHR, textStatus, errorThrown) {
    console.error('Error loading data:', textStatus, ', Details:', errorThrown);
  });
});

// 计算总页数
function calculateTotalPages(itemCount, itemsPerPage) {
  return Math.ceil(itemCount / itemsPerPage);
}

// 渲染当前页

function renderCurrentPage(searchedData, currentPage, itemsPerPage, selectedSearchMethod) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, searchedData.vulnerabilities.length);
  
  $('#search-results-container').empty();
  
  $.each(searchedData.vulnerabilities.slice(startIndex, endIndex), function(index, item) {
    let resultItemHtml = '<tr class="search-result">';
    
    switch (selectedSearchMethod) {
      case 'cveid':
      case 'keyword':
      case 'cpe':
        resultItemHtml += '<td class="destinationId">' + item.cve.id + '</td>';
        const englishDescription = item.cve.descriptions.find(description => description.lang === 'en');
        const valueToDisplay = englishDescription ? englishDescription.value : 'No English description available.';
        resultItemHtml += '<td>' + valueToDisplay + '</td>';
        
        const publishedDate = new Date(item.cve.published);
        const formattedPublishedDate = publishedDate.toISOString().slice(0, 19).replace('T', ' ');
        resultItemHtml += '<td>' + formattedPublishedDate + '</td>';
        const lastModifiedDate = new Date(item.cve.lastModified);
        const formattedLastModifiedDate = lastModifiedDate.toISOString().slice(0, 19).replace('T', ' ');
        
		resultItemHtml += '<td class="last-modified-date-cell">' + formattedLastModifiedDate + '</td>';
        resultItemHtml += '</tr>';
        break;
    }
    $('#search-results-container').append(resultItemHtml);
  });
  $('#current-page').text(currentPage);
}
// 监听CVE详情链接点击事件
$(document).on("click", "td.destinationId", function() {
  const destinationId = $(this).text();
  const cveDetail = window.data.vulnerabilities.find(vulnerability => vulnerability.cve.id === destinationId);

  if (cveDetail) {
    $('.modal').show(500, "linear");
  
    // 展示CVE详细信息逻辑
    $('#cveId').text(cveDetail.cve.id);
    $('#cveDescription').text(cveDetail.cve.descriptions.find(desc => desc.lang === 'en').value);
    const publishedDate = new Date(cveDetail.cve.published);
    const modifiedDate = new Date(cveDetail.cve.lastModified);
    $('#cvePublishedDate').text(publishedDate.toLocaleDateString() + ' ' + publishedDate.toLocaleTimeString());
    $('#cveModifiedDate').text(modifiedDate.toLocaleDateString() + ' ' + modifiedDate.toLocaleTimeString());
    $('#cveStatus').text(cveDetail.cve.vulnStatus);
    $('#cveSeverity').text(cveDetail.cve.metrics.cvssMetricV2[0].cvssData.vectorString);
    $('#cveWeakness').text(cveDetail.cve.weaknesses[0].description[0].value);
    let referenceUrls = [];
    
	cveDetail.cve.references.forEach(reference => {
      referenceUrls.push(`<a href="${reference.url}" target="_blank">${reference.url}</a>`);
    });
    
	$('#cveReferences').html(referenceUrls.join('<br/>'));
    $('#cveDetailsModal textarea').val(JSON.stringify(cveDetail, null, 2));
  
  } else {
    console.log('No CVE information matching ' + destinationId + 'could be found.');
  }
});