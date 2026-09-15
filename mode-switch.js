document.querySelector('#programMode').addEventListener('change', event => {
  const target = event.target.value;
  if (target === 'index.html' || target === 'upgraded.html') location.assign(target);
});
