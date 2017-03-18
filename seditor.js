var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
navigator.saveBlob = navigator.saveBlob || navigator.msSaveBlob || navigator.mozSaveBlob || navigator.webkitSaveBlob;
window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;
const ipc = require('electron').ipcRenderer;
const clipboard = require('electron').clipboard;
const fs = require('fs');
const path = require('path');

var updateTimer, scrollTimer;
var curFile;
var inSections=[], outSections=[], inLastTop, outLastTop;

// Because highlight.js is a bit awkward at times
var languageOverrides = {
  js: 'javascript',
  html: 'xml'
};

var md = markdownit({
  html: true,
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
  inSections=[];
  outSections=[];
  for (var i = 0; i < editor.getDoc().lineCount(); i++) {
    var outLine = document.querySelector('#line' + i);
    if (outLine) {
      outSections.push(outLine.offsetTop);
      inSections.push(editor.charCoords({line:i,ch:0},'local').top + 30); //30是编辑器里的padding
    }
  }
}

function update(e){
  clearTimeout(updateTimer);
  updateTimer = setTimeout(function() {
    renderOutput(e.getValue());
  }, 500);
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(function() {
    refreshSectionIndex();
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
}


editor.on('change', update);

editor.on('scroll', function(event) {

  clearTimeout(scrollTimer); //editor的行高是随着滚动动态刷的，所以这里只有定时刷了
  scrollTimer = setTimeout(function() {    
    refreshSectionIndex();
  }, 500);

  if (inSections.length == 0 || outSections.length == 0)
    return;

  var inDiv = document.querySelector(".CodeMirror-scroll");
  var outDiv = document.querySelector("#out");
  var inTop = inDiv.scrollTop;
  var inSection = 0;
  if (Math.abs(inTop - inLastTop) < 9) 
    return;

  inLastTop = inTop;
  for (var i = 1; i < inSections.length; i++) {
    if (inTop < inSections[i])  {
      inSection = i - 1;
      break;
    }
  }

  if (i >= inSections.length) {
    var percent = (inTop - inSections[i-1]) / ((inDiv.scrollHeight -  inSections[i-1]) || 1);
    var destPos = outSections[i-1] + (outDiv.scrollHeight - outSections[i-1]) * percent;
  }
  else {
    var percent = (inTop - inSections[i-1]) / ((inSections[i] -  inSections[i-1]) || 1); 
    var destPos = outSections[i-1] + (outSections[i] - outSections[i-1]) * percent;
  }
  outDiv.scrollTop = destPos;

});

document.querySelector("#out").addEventListener('scroll', function(event) {
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

ipc.on('paste', function (event) {
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
    fs.writeFile(imgfile, image.toPNG(), function (error, data) {
      if (error) reject(error);
      editor.replaceSelection ('\n![](images/' + datestamp + '.png)\n'); 
    }); 
  }
  else if (clipboard.availableFormats().indexOf("image/jpeg") != -1) {
    var imgfile = path.join(imgfolder,  datestamp +'.jpg');
    fs.writeFile(imgfile, image.toJPEG(), function (error, data) {
      if (error) reject(error);
      editor.replaceSelection ('\n![](images/' + datestamp + '.jpg)\n'); 
    });     
  }
  else if (clipboard.availableFormats().indexOf("text/plain") != -1) {
    var url = clipboard.readText();
    editor.replaceSelection ('\n![](' + url + ')\n'); 
  }  
});

update(editor);
editor.focus();
