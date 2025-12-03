
const tabs = document.querySelectorAll('.tab');
const editors = document.querySelectorAll('.editor');
const htmlEditor = document.getElementById('html');
const cssEditor = document.getElementById('css');
const jsEditor = document.getElementById('js');

const runBtn = document.getElementById('runBtn');
const autoRun = document.getElementById('autoRun');
const preview = document.getElementById('preview');

const downloadBtn = document.getElementById('downloadBtn');
const consoleBody = document.getElementById('consoleBody');
const liveIndicator = document.getElementById('liveIndicator');
const fileIndicator = document.querySelector('.file-indicator');

const fileNames = {
  'html': 'index.html',
  'css': 'style.css',
  'js': 'script.js'
};

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelector('.tab.active').classList.remove('active');
    tab.classList.add('active');

    document.querySelector('.editor.active').classList.remove('active');
    document.getElementById(tab.dataset.editor).classList.add('active');
    
    // Update file indicator
    if (fileIndicator) {
      fileIndicator.textContent = fileNames[tab.dataset.editor];
    }
  });
});

/* ---- build preview srcdoc ---- */
function buildSrcDoc(html, css, js){
  // basic sandboxed page with console proxy
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  /* reset preview background so it looks clean */
  html,body{height:100%;margin:0;background:white;color:#111;font-family:Inter,system-ui,Arial;}
  ${css}
</style>
</head>
<body>
${html}

<script>
  // capture console and forward messages to parent
  (function(){
    function send(type, args){
      try{
        parent.postMessage({ __neon_console: true, type: type, args: args }, '*');
      }catch(e){}
    }
    const methods = ['log','warn','error','info','debug'];
    methods.forEach(m => {
      const orig = console[m];
      console[m] = function(){
        send(m, Array.from(arguments).map(a => {
          try{ return typeof a === 'object' ? JSON.stringify(a) : String(a); }catch(e){ return String(a); }
        }));
        orig.apply(console, arguments);
      };
    });

    window.addEventListener('error', function(e){
      send('error', [e.message + ' (' + e.filename + ':' + e.lineno + ')' ]);
    });
  })();
</script>

<script>
try {
  ${js}
} catch(e) {
  console.error('Preview JS Error: ' + e);
}
</script>
</body>
</html>`;
}

/* ---- update preview (debounced) ---- */
let timeout;
function updatePreview(){
  const html = htmlEditor.value;
  const css = cssEditor.value;
  const js = jsEditor.value;
  const src = buildSrcDoc(html, css, js);
  preview.srcdoc = src;
  // show quick live pulse
  liveIndicator.style.opacity = '1';
  clearTimeout(timeout);
  timeout = setTimeout(() => (liveIndicator.style.opacity = '0.7'), 600);
}

/* run button */
runBtn.addEventListener('click', updatePreview);

/* auto-run on typing */
[htmlEditor, cssEditor, jsEditor].forEach(el => {
  el.addEventListener('input', () => {
    if (autoRun.checked) {
      clearTimeout(timeout);
      timeout = setTimeout(updatePreview, 300);
    }
  });
});

/* initial render */
updatePreview();

/* ---- download combined file ---- */
downloadBtn.addEventListener('click', () => {
  const html = htmlEditor.value;
  const css = cssEditor.value;
  const js = jsEditor.value;

  const full = buildSrcDoc(html, css, js);
  const blob = new Blob([full], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'neon-editor-project.html';
  a.click();
  URL.revokeObjectURL(url);
});

/* ---- console message listener from iframe ---- */
window.addEventListener('message', (ev) => {
  const data = ev.data;
  if (data && data.__neon_console) {
    const line = document.createElement('div');
    line.className = 'console-line';
    const time = new Date().toLocaleTimeString();
    
    // color based on console type
    let typeColor = '#00e5ff';  // default cyan for log
    let typeStyle = 'color:' + typeColor + ';';
    
    if (data.type === 'error') {
      typeColor = '#ff6b6b';    // red for error
    } else if (data.type === 'warn') {
      typeColor = '#ffd93d';    // yellow for warn
    } else if (data.type === 'info') {
      typeColor = '#6a9eff';    // light blue for info
    } else if (data.type === 'debug') {
      typeColor = '#a78bfa';    // purple for debug
    }
    
    line.innerHTML = `<span style="opacity:.6;color:#888">[${time}]</span> <span style="color:${typeColor};font-weight:600">${data.type}</span>: <span style="color:#cfefff">${data.args.join(' ')}</span>`;
    consoleBody.appendChild(line);
    consoleBody.scrollTop = consoleBody.scrollHeight;
  }
});

/* ---- simple drag-to-resize between panels ---- */
(function setupResizer() {
  const drag = document.getElementById('drag');
  const left = document.querySelector('.left-panel');
  const right = document.querySelector('.right-panel');
  let dragging = false;
  let startX, startWidth;

  drag.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startWidth = left.getBoundingClientRect().width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const newWidth = startWidth + dx;
    const min = 320;
    const max = window.innerWidth - 420;
    if (newWidth > min && newWidth < max) {
      left.style.width = newWidth + 'px';
    }
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // support vertical dragging on small screens
  drag.addEventListener('touchstart', (e) => {
    dragging = true;
    startX = e.touches[0].clientX;
    startWidth = left.getBoundingClientRect().width;
  });
  drag.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    left.style.width = (startWidth + dx) + 'px';
  });
  drag.addEventListener('touchend', () => { dragging = false; });
})();

/* ---- keyboard shortcut: Ctrl+S to run ---- */
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    updatePreview();
  }
});
