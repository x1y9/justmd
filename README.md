# justmd
Simple markdown editor based on electron.

## sync scroll
![](images/sync-scroll.gif)

## paste image 
![](images/paste-image.gif)

## paste html
![](images/paste-html.gif)

## paste word
![](images/paste-word.gif)


## more
* UML/flow chart support, [more](https://github.com/skanaar/nomnoml) 
* Tex math support, [more](https://github.com/Khan/KaTeX)
* export html
* export pdf
* optimized performance for large file edit


## install & run
After [download](https://github.com/i38/justmd/releases), unzip and run justmd

# develop
For china devlopers, set ELECTRON_MIRROR first:
* set ELECTRON_MIRROR=http://npm.taobao.org/mirrors/electron/

then, do install dependency and start dev
* npm install
* npm start

## debug
* press ALT+D to open devTools 

## build

for windows:
```
npm run package-x64
```
or
```
npm run package-x86
```

for linux:
```
npm run package-l64
```

for osx package(must under osx):
```
npm run package-osx
```

## todo
* osx paste html
* splitter
* sequence https://bramp.github.io/js-sequence-diagrams/
* flow http://flowchart.js.org/ 

# License

Copyright (c) 2017-present x1y9

[MIT License](http://en.wikipedia.org/wiki/MIT_License)