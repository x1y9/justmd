const {Menu} = require('electron')
const electron = require('electron')
const app = electron.app
const fs = require('fs')

const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New File',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('newFile')
         }
      },    
      {
        label: 'Open File...',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('openFile')
        }
      },    
      {
        label: 'Save',
        accelerator: 'Ctrl+S',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('saveFile')
        }
      },
      {
        label: 'Save As...',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('saveAsFile')
        }  
      },
      {
        type: 'separator'
      },            
      {
        label: 'Export PDF...',
        click: function(item, focusedWindow) {
          electron.dialog.showSaveDialog({
            title: 'Export PDF',
            filters:[{name:"Pdf File", extensions:["pdf"]}]
          }, function (filename) {
            if (filename) {
              focusedWindow.webContents.send('showBusyCursor');
              //做一个异步调用，以防止阻塞ui导致光标不能变为busy
              setTimeout(function() {
                focusedWindow.webContents.printToPDF({}, function (error, data) {
                  focusedWindow.webContents.send('showNormalCursor')
                  if (error) throw error;
                  fs.writeFile(filename, data, function (error) {
                    if (error) {
                      throw error
                    }
                  })
                });
              },100);
            }
          })  
        }
      },
      {
        label: 'Export HTML...',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('exportHtml')
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        role: 'undo'
      },
      {
        role: 'redo'
      },
      {
        type: 'separator'
      },
      {
        role: 'cut'
      },
      {
        role: 'copy'
      },
      {
        role: 'paste'
      },
      {
        label: 'Smart Paste',
        accelerator: 'Alt+V',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('smartPaste')        
         }
      },      
      {
        type: 'separator'
      },        
      {
        label: 'Paste Image',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('pasteImage')        
         }
      },
      {
        label: 'Paste Html',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('pasteHtml')
         }
      },
      {
        label: 'Paste Word',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('pasteWord')
         }
      },
      {
        type: 'separator'
      },        
      {
        label: 'Find',
        accelerator: 'Ctrl+F',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('find')        
        }
      },
      {
        label: 'Find Next',
        accelerator: 'Ctrl+G',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('findNext')        
        }
      },                        
      {
        label: 'Replace',
        accelerator: 'Ctrl+Shift+F',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('replace')        
        }
      }      
    ]
  },
  {
    label: 'Insert',
    submenu: [
      {
        label: 'Link',
        accelerator: 'Alt+L',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('insertLink')        
         }
      },  
      {
        label: 'Image',
        accelerator: 'Alt+I',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('insertImage')        
         }
      },          
      {
        label: 'Table',
        accelerator: 'Alt+T',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('insertTable')        
         }
      },
      {
        label: 'Code Block',
        accelerator: 'Alt+C',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('insertCode')        
         }
      },
      {
        label: 'Tex',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('insertTex')        
         }
      },        
      {
        label: 'UML',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('insertUML')        
         }
      },
      {
        label: 'Table of content',
        click: function(item, focusedWindow) {
          focusedWindow.webContents.send('insertTOC')        
         }
      }              
    ]
  },  
  {
    label: 'View',
    submenu: [
      {
        role: 'resetzoom'
      },
      {
        role: 'zoomin'
      },
      {
        role: 'zoomout'
      },
      {
        type: 'separator'
      },
      {
        role: 'togglefullscreen'
      }
    ]
  },
  {
    label: 'Option',
    submenu:  [
      {
        label: 'Html in Markdown',
        type: 'checkbox',
        checked: true,
        click (item, focusedWindow) {
          focusedWindow.webContents.send('switchParseHtml', item.checked);
        }
      },            
      {
        label: 'Link in Markdown',
        type: 'checkbox',
        checked: true,
        click (item, focusedWindow) {
          focusedWindow.webContents.send('switchLinkify', item.checked);
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Default theme',
        type: 'radio',
        checked: true,
        click (item, focusedWindow) {
          focusedWindow.webContents.send('switchTheme', "default");
        }
      },
      {
        label: 'Dark theme',
        type: 'radio',
        checked: false,
        click (item, focusedWindow) {
          focusedWindow.webContents.send('switchTheme', "dark");
        }
      },
      {
        label: 'User theme',
        type: 'radio',
        checked: false,
        click (item, focusedWindow) {
          focusedWindow.webContents.send('switchTheme', "user1");
        }
      },            
    ]
  },  
  {
    role: 'help',
    submenu: [
      {
        label: 'About',
        click () { electron.dialog.showMessageBox({message: 'justmd ' + app.getVersion() + ', Copyright 2017~2021 x1y9'});  }
      },    
      {
        label: 'Learn More',
        click () { electron.shell.openExternal('https://github.com/x1y9/justmd') }
      }
    ]
  }
]

if (process.platform === 'darwin') {
  
  template.unshift({
    label: "Justmd",
    submenu: [
      {
        role: 'about'
      },
      {
        type: 'separator'
      },
      {
        role: 'services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        role: 'hide'
      },
      {
        role: 'hideothers'
      },
      {
        role: 'unhide'
      },
      {
        type: 'separator'
      },
      {
        role: 'quit'
      }
    ]
  })
  
}

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)