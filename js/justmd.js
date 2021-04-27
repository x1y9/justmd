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
var scrollLastTop=[0,0], scrollDir = -1;
var parseDelay = 500;
var outSections = {};

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
    if (lang === 'uml') {
      try {
        return nomnoml.renderSvg(code);
      }catch(e){
        return e;
      } 
    }
    else if(lang && hljs.getLanguage(lang)){
      try {
        return hljs.highlight(lang, code).value;
      }catch(e){}
    }
    return '';
  }
}).use(markdownitFootnote)
.use(markdownitCheckbox)
.use(texmath.use(katex))
.use(markdownitTOC);
//.use(require('markdown-it-katex'));

var editor = CodeMirror.fromTextArea(document.getElementById('code'), {
  mode: 'gfm',
  lineNumbers: false,
  matchBrackets: true,
  lineWrapping: true
  //theme: 'base16-light'
  //extraKeys: {"Enter": "newlineAndIndentContinueMarkdownList"}
});


/*
  内部函数
*/

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

/*
  事件处理
*/

function onUpdate(isInit){
  curChanged = !isInit;
  refreshWindowTitle();
  clearTimeout(updateTimer);
  updateTimer = setTimeout(function() {
    renderOutput(editor.getValue());
  }, parseDelay);
}

function renderOutput(val){
  if (curFile) {
    val = val.replace(/!\[(.*?)\]\(([^:\)]*)\)/ig, function(match, label, name){
      return '![' + label + '](file://' + path.dirname(curFile) + "/" + name + ")";
    });
  }

  var out = document.getElementById('out');
  out.innerHTML = md.render(val);
  refreshSectionIndex();
}

function onSizeChange(){
  //浏览器大小变化时，DOM没有变，只需要清除位置信息即可，无需重刷新DOM
  for (var key in outSections) {
    if (outSections.hasOwnProperty(key)) {
      outSections[key] = -1;
    }
  }
}

function refreshSectionIndex() {
  //行高是随着加载动态刷的，所以这里只能刷DOM，不缓存行位置，位置在需要时临时刷新
  outSections = {};
  var maxLine = 0;
  for (var i = 0; i < editor.getDoc().lineCount(); i++) {
    //getElementById 比 querySelector快几倍
    var outLine = document.getElementById('line' + i);
    if (outLine) {
      maxLine = i;
      outSections[i] = -1;
    }
  }
  //console.log("refresh section, max line:" + maxLine);
}

function onScroll(dir) {
  //检查是否是一侧滚动触发的另一侧滚动事件
  if (Object.keys(outSections).length == 0  || scrollDir === dir ) {
    scrollDir = -1;
    return;
  }
  
  var scrollDivs = [document.querySelector(".CodeMirror-scroll"), document.querySelector("#out")];
  var y = scrollDivs[dir].scrollTop;  
  if (Math.abs(y - scrollLastTop[y]) < 9) 
    return;

  scrollLastTop[dir] = y;
  scrollDir = 1 - dir;

  if (dir == 0) {
    //editor触发, 要减去30的padding
    y = y - 30;
    var line = editor.coordsChar({left:0,top:y},'local').line;
    var lines = Object.keys(outSections);
    for (var i = 0; i < lines.length - 1; i++) {
      if (line >= lines[i] && line < lines[i+1])
        break;
    }

    if (line < lines[0]) {
      var leftTop = 0;
      var leftBottom = editor.charCoords({line:lines[0],ch:0},'local').top;
      var rightTop = 0;
      var rightBottom = getOutSectionTop(lines[0]);
      outSections[lines[0]] = rightBottom;
    }
    else if(i >= lines.length - 1) {
      var leftTop = editor.charCoords({line:lines[i],ch:0},'local').top;
      var leftBottom = scrollDivs[0].scrollHeight;
      var rightTop = getOutSectionTop(lines[i]);
      outSections[lines[i]] = rightTop;
      var rightBottom = scrollDivs[1].scrollHeight;
    }
    else {
      var leftTop = editor.charCoords({line:lines[i],ch:0},'local').top;
      var leftBottom = editor.charCoords({line:lines[i+1],ch:0},'local').top;
      var rightTop = getOutSectionTop(lines[i]);
      outSections[lines[i]] = rightTop;
      var rightBottom = getOutSectionTop(lines[i+1]);
      outSections[lines[i + 1]] = rightBottom;
    }
    var percent = (y - leftTop) / ((leftBottom - leftTop) || 1);
    var rightY = rightTop + (rightBottom - rightTop) * percent;
    //console.log("dir:" + dir + ",to:" + rightY);
    scrollDivs[1-dir].scrollTop = rightY  + 10;    
  }
  else {
    //out触发    
    y = y - 10;
    var lines = Object.keys(outSections);

    if (y >= getOutSectionTop(lines[0]))  {
      for (var i = 0; i < lines.length - 1; i++) {
        if (y >= getOutSectionTop(lines[i]) && y < getOutSectionTop(lines[i+1]))
          break;
      }
    }

    //判断是否最前或最后
    if (y < outSections[lines[0]]) {
      var leftTop = 0;
      var leftBottom = editor.charCoords({line:lines[0],ch:0},'local').top;
      var rightTop = 0;
      var rightBottom = outSections[lines[0]];
    }
    else if(i >= lines.length - 1) {
      var leftTop = editor.charCoords({line:lines[i],ch:0},'local').top;
      var leftBottom = scrollDivs[0].scrollHeight;
      var rightTop = outSections[lines[i]];
      var rightBottom = scrollDivs[1].scrollHeight;;
    }
    else {
      var leftTop = editor.charCoords({line:lines[i],ch:0},'local').top;
      var leftBottom = editor.charCoords({line:lines[i+1],ch:0},'local').top;
      var rightTop = outSections[lines[i]];
      var rightBottom = outSections[lines[i + 1]];
    }

    var percent = (y - rightTop) / ((rightBottom - rightTop) || 1);
    var leftY = leftTop + (leftBottom - leftTop) * percent;

    //console.log("dir:" + dir + ",to:" + leftY);
    scrollDivs[1-dir].scrollTop = leftY + 30;
  }
}

function getOutSectionTop(line) {
    if (outSections[line] == -1)
      outSections[line] = document.getElementById('line' + line).offsetTop;
    return outSections[line];
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
  else {
    alert("No valid content in clipboard!");
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
  if (!curFile) {
    alert("please save your markdown file before paste from word");
    return;
  }

  if (clipboard.availableFormats().indexOf("text/html") != -1) {
    var html = clipboard.readHTML().replace(/(class|style)="[\s\S]*?"/g, '');
    //有些word paste用<v:imagedata 表示图片，转为html image
    html = html.replace(/<(\/?)v:imagedata/g, '<$1image');
    var md = toMarkdown(html, { gfm: true });
    md = md.replace(/<\/?(span|div|a|o:p|v:.*?|input|label)[\s\S]*?>/g, ''); 
    var datestamp = new Date().toISOString().replace(/[^0-9]/g,'');
    var imgfolder = path.join(path.dirname(curFile), "images");
    try {
      fs.mkdirSync(imgfolder);
    } catch(e) {    
    }

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

function onInsertTex() {
  var select = editor.getSelection();
  if (select)
    editor.replaceSelection ('\n$$' + select + '$$\n'); 
  else
    editor.replaceSelection ('\n$$c = \\sqrt{a^2 + b^2}$$\n'); 
}

function onInsertUML() {
  var select = editor.getSelection();
  if (select)
    editor.replaceSelection ('\n```uml\n' + select + '\n```\n'); 
  else
    editor.replaceSelection ('\n```uml\n[<start>st]->[<state>plunder]\n[plunder]->[<choice>more loot]\n[more loot]->[st]\n[more loot] no ->[<end>e]\n```\n'); 
}

function onInsertTOC() {
  editor.replaceSelection ('\n[toc]\n'); 
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

document.querySelector("#bt-tex").addEventListener('click', function(event) {
  onInsertTex(); 
}, false); 

document.querySelector("#bt-uml").addEventListener('click', function(event) {
  onInsertUML(); 
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
ipc.on('insertTex', onInsertTex);
ipc.on('insertUML', onInsertUML);
ipc.on('insertTOC', onInsertTOC);

ipc.on('switchParseHtml', function (event, enable) {
  md.set({html:enable});
  onUpdate(false);  
});

ipc.on('switchLinkify', function (event, enable) {
  md.set({linkify:enable});
  onUpdate(false);  
});

ipc.on('switchTheme', function (event, theme_id) {
  var i, link_tag ;
  for (i = 0, link_tag = document.getElementsByTagName("link");i < link_tag.length ; i++ ) {
    if ((link_tag[i].rel.indexOf( "stylesheet" ) != -1) && link_tag[i].title) {
      link_tag[i].disabled = true ;
      if (link_tag[i].title === theme_id) {
        link_tag[i].disabled = false ;
      }
    }
  }
});

ipc.on('showBusyCursor', function(event) {document.body.classList.add('busy-cursor');});
ipc.on('showNormalCursor', function(event) {document.body.classList.remove('busy-cursor');});

//用隐藏的快捷键替代标准键
document.addEventListener("keydown", function (e) {
    if (e.key === 'd' && e.altKey) {
      remote.getCurrentWindow().toggleDevTools();
    } else if (e.key === 'r' && e.altKey) {
      location.reload();
    }
});

onUpdate(true);
window.addEventListener("resize", onSizeChange, false);
editor.focus();

