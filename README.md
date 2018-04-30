# justmd
Simple markdown editor based on electron.

![](http://www.i38.me/public/images/sync-scroll.gif)

# run
npm install
npm start

# build
before build:
set ELECTRON_MIRROR=http://npm.taobao.org/mirrors/electron/

for windows package:
```
npm run package-x86
```
or
```
npm run package-x64
```

for osx package(must use osx host):  
```
npm run package-osx
```

## todo
* osx paste html
* splitter
* sequence https://bramp.github.io/js-sequence-diagrams/
* flow http://flowchart.js.org/ 
