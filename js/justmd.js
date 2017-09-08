var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
navigator.saveBlob = navigator.saveBlob || navigator.msSaveBlob || navigator.mozSaveBlob || navigator.webkitSaveBlob;
window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;
const ipc = require('electron').ipcRenderer;
const clipboard = require('electron').clipboard;
const shell  = require('electron').shell;
const fs = require('fs');
const remote = require('electron').remote;
const path = require('path');

var updateTimer, scrollTimer;
var curChanged, curFile;
var scrollSections=[[],[]], scrollLastTop=[0,0], scrollDir = -1;

// Because highlight.js is a bit awkward at times
var languageOverrides = {
  js: 'javascript',
  html: 'xml'
};

var md = markdownit({
  breaks:true,            //回车会换行
  html:true,              //识别正文中的html
  linkify:true,           //识别正文中url
  highlight: function(code, lang){
    if(languageOverrides[lang]) lang = languageOverrides[lang];
    if(lang && hljs.getLanguage(lang)){
      try {
        return hljs.highlight(lang, code).value;
      }catch(e){}
    }
    return '';
  }
}).use(markdownitFootnote);

var editor = CodeMirror.fromTextArea(document.getElementById('code'), {
  mode: 'gfm',
  lineNumbers: false,
  matchBrackets: true,
  lineWrapping: true
  //theme: 'base16-light'
  //extraKeys: {"Enter": "newlineAndIndentContinueMarkdownList"}
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
 
function refreshWindowTitle() {
  var title;
  if (curFile)
    title = curFile;
  else
    title = "untitled";

  if (curChanged)
    title = title + " *";

  ipc.send('setChanged', curChanged);
  remote.getCurrentWindow().setTitle(title);
}

function validateChange() {
  if (curChanged) {
    var choice = remote.dialog.showMessageBox(remote.getCurrentWindow(),
        {
          type: 'question',
          buttons: ['Yes', 'No'],
          title: 'Confirm',
          noLink: true,
          message: 'File changed, Are you sure you want to discard the change?'
       });

    if (choice == 1) {
      return false;
    }
  }
  return true;
}


function onUpdate(isInit){
  curChanged = !isInit;
  refreshWindowTitle();
  clearTimeout(updateTimer);
  updateTimer = setTimeout(function() {
    renderOutput(editor.getValue());
  }, 500);
}

function onNewFile() {
  if (validateChange()) {
    editor.setValue('# title');
    curFile = '';
    curChanged = false;
    refreshWindowTitle();
  }
}

function onOpenFile() {
  if (validateChange()) {
    remote.dialog.showOpenDialog({
        properties: ['openFile'],
        filters:[{name:"markdown File", extensions:["md","markdown"]}]
    }, function(filenames) {              
        if (filenames) {
          fs.readFile(filenames[0], 'utf8', function (error, data) {
            if (error)
                reject(error);

            curFile = filenames[0].replace(/\\/g,"/");  
            editor.setValue(data);
            curChanged = false;
            refreshWindowTitle();
          }); 
        }
    })
  }
}


function onSaveFile() {
  if (curFile) {
    saveFile(curFile);
  }
  else {
    remote.dialog.showSaveDialog({
      title: 'Save file',
      filters:[{name:"Markdown File", extensions:["md","markdown"]}]
    }, function (filename) {
      if (filename) {
        saveFile(filename);
      }
    });          
  }
}

function onSaveAsFile() {
  remote.dialog.showSaveDialog({
    title: 'Save as file',
    filters:[{name:"Markdown File", extensions:["md","markdown"]}]
  }, function (filename) {
    if (filename) {
      saveFile(filename);
    }
  });          
}

function saveFile(path) {
  fs.writeFile(path, editor.getValue(), function (error, data) {
    if (error)
        reject(error);

    curFile = path.replace(/\\/g,"/");  
    curChanged = false;
    refreshWindowTitle();
  }); 
}

function onExportHtml() {
  remote.dialog.showSaveDialog({
    title: 'Export HTML',
    filters:[{name:"Html File", extensions:["html"]}]
  }, function (filename) {
    if (filename) {
      fs.writeFile(filename, document.getElementById('out').innerHTML, function (error, data) {
      if (error)
            reject(error);
      }); 
    }
  })
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

function onSmartPaste() {
  var formats = clipboard.availableFormats(); 
  if (formats.indexOf("image/jpeg") != -1 || formats.indexOf("image/png") != -1) {
    onPasteImage();
  }  
  else if (formats.indexOf("text/rtf") != -1) {
    onPasteWord();
  }  
  else if (formats.indexOf("text/html") != -1) {
    onPasteHtml();
  }  
  else if (formats.indexOf("text/plain") != -1) {
    editor.replaceSelection(clipboard.readText());
  } 
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
}

function onPasteWord() {
  if (clipboard.availableFormats().indexOf("text/html") != -1) {
    var html = clipboard.readHTML().replace(/(class|style)="[\s\S]*?"/g, '');
    var md = toMarkdown(html, { gfm: true });
    md = md.replace(/<\/?(span|div|a|o:p|input|label)[\s\S]*?>/g, ''); 
    if (md.indexOf('file:///') != -1 && !curFile) {
      alert("please save your markdown file before paste image from word");
      return;
    }

    var datestamp = new Date().toISOString().replace(/[^0-9]/g,'');
    var imgfolder = path.join(path.dirname(curFile), "images");
    var imageIdx = 1;
    md = md.replace(/(!\[.*?\])\(file:\/\/\/(.*?)\)/g, function(match, title, url){
      var target = path.join(imgfolder, datestamp + '-' + imageIdx + path.extname(url));
      fs.createReadStream(url).pipe(fs.createWriteStream(target));
      return title + '(images/' +  datestamp + '-' + (imageIdx++) + path.extname(url) + ')';
    });
    editor.replaceSelection(md); 
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

function onBold() {
  var select = editor.getSelection();
  if (select)
    editor.replaceSelection ('**' + editor.getSelection() + '**'); 
  else
    editor.replaceSelection ('**' + 'content' + '**'); 
}

function onQuote() {
  var select = editor.getSelection();
  if (select)
    editor.replaceSelection ('> ' + select.replace(/(\r\n|\r|\n)/g, '$1> ')); 
  else
    editor.replaceSelection ('\n> content\n');

}

function onUnorderList() {
   var select = editor.getSelection();
  if (select)
    editor.replaceSelection ('* ' + select.replace(/(\r\n|\r|\n)/g, '$1* '));   
  else
    editor.replaceSelection ('\n* content\n'); 
}

function onOrderList() {
  var select = editor.getSelection();
  if (select)
    editor.replaceSelection ('1. ' + select.replace(/(\r\n|\r|\n)/g, '$11. '));   
  else
    editor.replaceSelection ('\n1. content\n'); 
}

function onInsertImage() {
  var select = editor.getSelection();
  if (select)
    editor.replaceSelection ('![' + select + '](images/foo.png)'); 
  else
    editor.replaceSelection ('![](images/foo.png)'); 
}

function onInsertTable() {
  editor.replaceSelection ('\n| Table  | Are  | Cool|\n| ------ |------| ----|\n| cell   |      |     |\n'); 
}

function onInsertLink() {
  var select = editor.getSelection();
  if (select)
    editor.replaceSelection ('[' + select + '](http://)'); 
  else
    editor.replaceSelection ('[title](http://)'); 
}

function onInsertCode() {
  var select = editor.getSelection();
  if (select)
    editor.replaceSelection ('\n```java\n' + select + '\n```\n'); 
  else
    editor.replaceSelection ('\n```java\nfoo=bar\n```\n'); 
}

editor.on('change', function(event){
  onUpdate(false);
});

editor.on('scroll', function(event) {
  onScroll(0);
});

document.querySelector("#out").addEventListener('scroll', function(event) {
  onScroll(1); 
}, false); 

document.addEventListener('click', function(event) {
    if (event.srcElement.nodeName == 'A' && event.srcElement.href.indexOf("http") == 0) {
      event.preventDefault();
      shell.openExternal(event.srcElement.href);
    }
});

document.querySelector("#bt-open").addEventListener('click', function(event) {
  onOpenFile();  
}, false); 

document.querySelector("#bt-save").addEventListener('click', function(event) {
  onSaveFile();  
}, false); 

document.querySelector("#bt-smart-paste").addEventListener('click', function(event) {
  onSmartPaste();  //普通paste不知道怎么用js触发
}, false); 

document.querySelector("#bt-bold").addEventListener('click', function(event) {
  onBold(); 
}, false); 

document.querySelector("#bt-quote").addEventListener('click', function(event) {
  onQuote(); 
}, false); 

document.querySelector("#bt-ul").addEventListener('click', function(event) {
  onUnorderList(); 
}, false); 

document.querySelector("#bt-ol").addEventListener('click', function(event) {
  onOrderList(); 
}, false); 

document.querySelector("#bt-image").addEventListener('click', function(event) {
  onInsertImage(); 
}, false); 

document.querySelector("#bt-link").addEventListener('click', function(event) {
  onInsertLink(); 
}, false); 

document.querySelector("#bt-table").addEventListener('click', function(event) {
  onInsertTable(); 
}, false); 

document.querySelector("#bt-code").addEventListener('click', function(event) {
  onInsertCode(); 
}, false); 

ipc.on('newFile', onNewFile);

ipc.on('openFile', onOpenFile);

ipc.on('saveFile', onSaveFile);

ipc.on('saveAsFile', onSaveAsFile);

ipc.on('exportHtml', onExportHtml);

ipc.on('pasteImage', onPasteImage);

ipc.on('pasteWord', onPasteWord);

ipc.on('pasteHtml', onPasteHtml);

ipc.on('smartPaste', onSmartPaste);

ipc.on('find', function(event) {
  editor.execCommand('find');
});

ipc.on('findNext', function(event) {
  editor.execCommand('findNext');
});

ipc.on('replace', function(event) {
  editor.execCommand('replace');
});

ipc.on('insertLink', onInsertLink);

ipc.on('insertImage', onInsertImage);

ipc.on('insertTable', onInsertTable);

ipc.on('insertCodeBlock', onInsertCode);


ipc.on('switchParseHtml', function (event, enable) {
  md.set({html:enable});
  onUpdate(false);  
});

ipc.on('switchLinkify', function (event, enable) {
  md.set({linkify:enable});
  onUpdate(false);  
});

onUpdate(true);
editor.focus();
