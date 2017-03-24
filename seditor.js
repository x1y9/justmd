var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
navigator.saveBlob = navigator.saveBlob || navigator.msSaveBlob || navigator.mozSaveBlob || navigator.webkitSaveBlob;
window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;
const ipc = require('electron').ipcRenderer;
const clipboard = require('electron').clipboard;
const fs = require('fs');
const path = require('path');
//const toMarkdown = require('to-markdown');

var updateTimer, scrollTimer;
var curFile;
var scrollSections=[[],[]], scrollLastTop=[0,0], scrollDir = -1;

// Because highlight.js is a bit awkward at times
var languageOverrides = {
  js: 'javascript',
  html: 'xml'
};

var md = markdownit({
  highlight: function(code, lang){
    if(languageOverrides[lang]) lang = languageOverrides[lang];
    if(lang && hljs.getLanguage(lang)){
      try {
        return hljs.highlight(lang, code).value;
      }catch(e){}
    }
    return '';
  }
})
  .use(markdownitFootnote);

var editor = CodeMirror.fromTextArea(document.getElementById('code'), {
  mode: 'gfm',
  lineNumbers: false,
  matchBrackets: true,
  lineWrapping: true,
  theme: 'base16-light',
  extraKeys: {"Enter": "newlineAndIndentContinueMarkdownList"}
});

function refreshSectionIndex() {
  scrollSections[0]=[];
  scrollSections[1]=[];
  for (var i = 0; i < editor.getDoc().lineCount(); i++) {
    var outLine = document.querySelector('#out > #line' + i);
    if (outLine) {
      scrollSections[1].push(outLine.offsetTop);
      scrollSections[0].push(editor.charCoords({line:i,ch:0},'local').top + 30); //30是编辑器里的padding
    }
  }
}

function onUpdate(e){
  clearTimeout(updateTimer);
  updateTimer = setTimeout(function() {
    renderOutput(e.getValue());
  }, 500);
}

function onRender(){
  //editor的行高是随着滚动动态刷的，所以这里只有定时刷了
  clearTimeout(scrollTimer); 
  scrollTimer = setTimeout(function() {    
    refreshSectionIndex();
    scrollDir = -1;
  }, 500);
}

function renderOutput(val){
  if (curFile) {
    val = val.replace(/!\[(.*?)\]\(([^:\)]*)\)/ig, function(match, label, name){
      return '![' + label + '](file://' + path.dirname(curFile) + "/" + name + ")";
    });
  }

  var out = document.getElementById('out');
  out.innerHTML = md.render(val);
  onRender();
}

function onScroll(dir) {
  onRender();
  if (scrollSections[0].length == 0 || scrollSections[1].length == 0 || scrollDir === 1 - dir )
    return;

  scrollDir = dir; 
  var scrollDivs = [document.querySelector(".CodeMirror-scroll"), document.querySelector("#out")];
  var scrollTop = scrollDivs[scrollDir].scrollTop;
  
  if (Math.abs(scrollTop - scrollLastTop[scrollDir]) < 9) 
    return;

  var curSection = 0;
  scrollLastTop[scrollDir] = scrollTop;
  for (var i = 1; i < scrollSections[scrollDir].length; i++) {
    if (scrollTop < scrollSections[scrollDir][i])  {
      curSection = i - 1;
      break;
    }
  }

  if (i >= scrollSections[scrollDir].length) {
    var percent = (scrollTop - scrollSections[scrollDir][i-1]) / ((scrollDivs[scrollDir].scrollHeight -  scrollSections[scrollDir][i-1]) || 1);
    var destPos = scrollSections[1-scrollDir][i-1] + (scrollDivs[1-scrollDir].scrollHeight - scrollSections[1-scrollDir][i-1]) * percent;
  }
  else {
    var percent = (scrollTop - scrollSections[scrollDir][i-1]) / ((scrollSections[scrollDir][i] -  scrollSections[scrollDir][i-1]) || 1); 
    var destPos = scrollSections[1-scrollDir][i-1] + (scrollSections[1-scrollDir][i] - scrollSections[1-scrollDir][i-1]) * percent;
  }
  scrollDivs[1-scrollDir].scrollTop = destPos;
}

function onPasteImage() {
  if (!curFile) {
    alert("please save your file first before paste image");
    return;
  }

  var datestamp = new Date().toISOString().replace(/[^0-9]/g,'');
  var imgfolder = path.join(path.dirname(curFile), "images");
  try {
    fs.mkdirSync(imgfolder);
  } catch(e) {    
  }

  if (clipboard.availableFormats().indexOf("image/png") != -1) {
    var imgfile = path.join(imgfolder,  datestamp +'.png');
    fs.writeFile(imgfile, clipboard.readImage().toPNG(), function (error, data) {
      if (error) reject(error);
      editor.replaceSelection ('\n![](images/' + datestamp + '.png)\n'); 
    }); 
  }
  else if (clipboard.availableFormats().indexOf("image/jpeg") != -1) {
    var imgfile = path.join(imgfolder,  datestamp +'.jpg');
    fs.writeFile(imgfile, clipboard.readImage().toJPEG(), function (error, data) {
      if (error) reject(error);
      editor.replaceSelection ('\n![](images/' + datestamp + '.jpg)\n'); 
    });     
  }
  else if (clipboard.availableFormats().indexOf("text/html") != -1) {
    var html = clipboard.readHTML();
    editor.replaceSelection (toMarkdown(html, { gfm: true })); 
  }  
}

function onPasteWord() {
  if (clipboard.availableFormats().indexOf("text/html") != -1) {
    //for word, remove all property
    var html = clipboard.readHTML().replace(/<([a-z][a-zA-Z0-9]*)\s[\s\S]*?>/g, '<$1>');
    html = html.replace(/<!\[if[\s\S]*?endif\]>/g, ''); //remove <![if
    var md = toMarkdown(html, { gfm: true });
    md = md.replace(/<\/?(span|div|a|o:p|input|label)[\s\S]*?>/g, ''); 
    editor.replaceSelection (md); 
  }   
}

function onPasteHtml() {
  if (clipboard.availableFormats().indexOf("text/html") != -1) {
    //leave href,src
    var html = clipboard.readHTML().replace(/(class|style)="[\s\S]*?"/g, '');
    var md = toMarkdown(html, { gfm: true });
    md = md.replace(/<\/?(span|div|a|input|label)[\s\S]*?>/g, ''); 
    editor.replaceSelection(md); 
  }    
}

editor.on('change', onUpdate);

editor.on('scroll', function(event) {
  onScroll(0)
});

document.querySelector("#out").addEventListener('scroll', function(event) {
  onScroll(1); 
}, false); 


ipc.on('newFile', function (event) {
  editor.setValue('# title');
  curFile = '';
});

ipc.on('openFile', function (event,path) {
  fs.readFile(path, 'utf8', function (error, data) {
    if (error)
        reject(error);
    curFile = path.replace(/\\/g,"/");  
    editor.setValue(data);
  }); 
});

ipc.on('saveFile', function (event,path) {
  fs.writeFile(path, editor.getValue(), function (error, data) {
    if (error)
        reject(error);

    curFile = path.replace(/\\/g,"/");  
  }); 
});

ipc.on('exportHtml', function (event,path) {
  fs.writeFile(path, document.getElementById('out').innerHTML, function (error, data) {
    if (error)
        reject(error);
  }); 
});

ipc.on('pasteImage', onPasteImage);

ipc.on('pasteWord', onPasteWord);

ipc.on('pasteHtml', onPasteHtml);

ipc.on('smartPaste', function (event) {
  if (clipboard.availableFormats().indexOf("image/jpeg") != -1) {
    onPasteImage();
  }  
  else if (clipboard.availableFormats().indexOf("text/rtf") != -1) {
    onPasteWord();
  }  
  else if (clipboard.availableFormats().indexOf("text/html") != -1) {
    onPasteHtml();
  }  
  else if (clipboard.availableFormats().indexOf("text/plain") != -1) {
    editor.replaceSelection(clipboard.readText());
  } 
});

ipc.on('insertTable', function (event,path) {
  editor.replaceSelection ('\n| Table  | Are  | Cool|\n| ------ |------| ----|\n| cell   |      |     |\n'); 
});

ipc.on('insertCodeBlock', function (event,path) {
  editor.replaceSelection ('\n```\nfoo=bar\n```\n'); 
});


ipc.on('switchParseHtml', function (event, enable) {
  md.set({html:enable});
  onUpdate(editor);  
});

onUpdate(editor);
editor.focus();
