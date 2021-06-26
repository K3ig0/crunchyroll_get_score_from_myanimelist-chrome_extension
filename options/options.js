function saveCurrentOptions() {
  var fadeScore = document.getElementById('fade_score').value;
  var fadeOpacity = document.getElementById('fade_opacity').value;
  chrome.storage.sync.set({
    fadeScore,
    fadeOpacity
  }, function() {
    var status = document.getElementById('status');
    status.textContent = chrome.i18n.getMessage('optionsSaved');
    setTimeout(function() {
      status.textContent = '';
    }, 3000);
  });
}

function restoreLastSavedOptions() {
  // Use default values if not defined
  chrome.storage.sync.get({
    fadeScore: 7.00,
    fadeOpacity: 0.1
  }, function(items) {
    document.getElementById('fade_score').value = items.fadeScore;
    document.getElementById('fade_opacity').value = items.fadeOpacity;
  });
}

function restoreInitialDefaultOptions() {
  document.getElementById('fade_score').value = 7.00;
  document.getElementById('fade_opacity').value = 0.1;
  saveCurrentOptions();
}

function clearChromeLocalStorage() {
  chrome.storage.local.clear();
  var status = document.getElementById('status');
  status.textContent = chrome.i18n.getMessage('cacheCleared');
  setTimeout(function() {
    status.textContent = '';
  }, 3000);
}
  
document.addEventListener('DOMContentLoaded', restoreLastSavedOptions);
document.getElementById('save').addEventListener('click', saveCurrentOptions);
document.getElementById('restore').addEventListener('click', restoreInitialDefaultOptions);
document.getElementById('clearCache').addEventListener('click', clearChromeLocalStorage);