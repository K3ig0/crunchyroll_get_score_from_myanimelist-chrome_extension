function save_options() {
  var fadeScore = document.getElementById('fade_score').value;
  var fadeOpacity = document.getElementById('fade_opacity').value;
  chrome.storage.sync.set({
    fadeScore,
    fadeOpacity
  }, function() {
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 3000);
  });
}

function restore_last_saved_options() {
  // Use default values if not defined
  chrome.storage.sync.get({
    fadeScore: 7.00,
    fadeOpacity: 0.1
  }, function(items) {
    document.getElementById('fade_score').value = items.fadeScore;
    document.getElementById('fade_opacity').value = items.fadeOpacity;
  });
}

function restore_initial_default_options() {
  document.getElementById('fade_score').value = 7.00;
  document.getElementById('fade_opacity').value = 0.1;
  save_options();
}
  
document.addEventListener('DOMContentLoaded', restore_last_saved_options);
document.getElementById('save').addEventListener('click', save_options);
document.getElementById('restore').addEventListener('click', restore_initial_default_options);