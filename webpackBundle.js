const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');


function makeFileSource(filename) { // 获取单个文件内容
  const content = fs.readFileSync(filename, 'utf-8'); // 获取文件字符串
  const ast = parser.parse(content, { // 转成AST
    sourceType: 'module'
  });

  const dependencies = {};

  traverse(ast, { // 获取到文件的依赖
    ImportDeclaration( {node }) {
      const dirname = path.dirname(filename)
      let value = node.source.value;
      let filePath = './' + path.join(dirname, value);
      if (!path.extname(filePath)) {
        value += '.js';
        filePath += '.js';
      }
      dependencies[value] = filePath;
    }
  }) 

  const { code } = babel.transformFromAst(ast, null, { // 转成ES5代码
    presets:["@babel/preset-env"]
  }) 

  return {
    code,
    dependencies,
    filename
  }
}


function makeDepGraph(entry) { // 广度优先遍历获取到所有依赖 
  const entryModule = makeFileSource(entry);
  const graphArr = [ entryModule ];
  for( let i=0; i<graphArr.length; i++) {
    const item = graphArr[i];
    const { dependencies = {} } = item;
    if (dependencies) {
      for(let j in dependencies) {
        graphArr.push(makeFileSource(dependencies[j]))
      }
    }
  }
  const graph = {};
  graphArr.forEach(item => {
    graph[item.filename] = {
      code: item.code,
      dependencies: item.dependencies
    }
  })
  return graph;
}

function generateCode(entry) { // 生成浏览器可执行的代码
  const graph = JSON.stringify(makeDepGraph(entry));
  return `
        (function(graph){
            function require(module){
                function localRequire(relativePath){
                    return require(graph[module].dependencies[relativePath])
                }
                var exports={};
                (function(require,exports,code){
                    eval(code)
                })(localRequire,exports,graph[module].code);
                return exports;
            };
            require('${entry}');
        })(${graph})
    `;
}

console.log(generateCode('./src/index.js'))