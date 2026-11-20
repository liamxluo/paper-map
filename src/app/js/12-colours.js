/* ===================== colours ===================== */
function applyColors(){
  const root = document.documentElement;
  root.setAttribute('data-paper', settings.paper || 'mist');
  if(settings.theme === 'light' || settings.theme === 'dark') root.setAttribute('data-theme', settings.theme); else root.removeAttribute('data-theme');
  const c = settings.colors;
  ['green','red'].forEach(k => {
    const hex = c && c[k];
    const rgb = hexToRgb(hex);
    if(rgb){
      root.style.setProperty('--' + k, hex);
      root.style.setProperty('--' + k + '-a', 'rgba(' + rgb.join(',') + ',.15)');
      root.style.setProperty('--' + k + '-ink', hex);
    }else{
      root.style.removeProperty('--' + k);
      root.style.removeProperty('--' + k + '-a');
      root.style.removeProperty('--' + k + '-ink');
    }
  });
}
