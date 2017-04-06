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
          electron.dialog.showSaveDialog({title: 'Export PDF'}, function (filename) {
            if (filename) {
              focusedWindow.webContents.printToPDF({}, function (error, data) {
                if (error) throw error
                fs.writeFile(filename, data, function (error) {
                  if (error) {
                    throw error
                  }
                })
              })
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
      },              
      {
        type: 'separator'
      },        
      {
        label: 'Options',
        submenu: [
          {
            label: 'Html in Markdown',
            type: 'checkbox',
            click (item, focusedWindow) {
              focusedWindow.webContents.send('switchParseHtml', item.checked);
            }
          }            
        ]
      },      
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
          focusedWindow.webContents.send('insertCodeBlock')        
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
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click (item, focusedWindow) {
          if (focusedWindow) focusedWindow.webContents.toggleDevTools()
        }
      }
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'About',
        click () { electron.dialog.showMessageBox({message: 'justmd v1.0.2, Copyright 2017 i38.me'});  }
      },    
      {
        label: 'Learn More',
        click () { electron.shell.openExternal('http://i38.me/justmd/') }
      }
    ]
  }
]

if (process.platform === 'darwin') {
  const name = app.getName()
  template.unshift({
    label: name,
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
  // Edit menu.
  template[1].submenu.push(
    {
      type: 'separator'
    },
    {
      label: 'Speech',
      submenu: [
        {
          role: 'startspeaking'
        },
        {
          role: 'stopspeaking'
        }
      ]
    }
  )
  // Window menu.
  template[3].submenu = [
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      role: 'close'
    },
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize'
    },
    {
      label: 'Zoom',
      role: 'zoom'
    },
    {
      type: 'separator'
    },
    {
      label: 'Bring All to Front',
      role: 'front'
    }
  ]
}

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)