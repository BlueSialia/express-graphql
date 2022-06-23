import { readFileSync } from 'fs';
import path from 'path';
import * as ts from 'typescript';

/**
 * Transforms:
 *
 *  loadFileStaticallyFromNPM(<npm path>)
 *
 * to:
 *
 *  "<file content>"
 */
export default function (_program: ts.Program, _pluginOptions: {}) {
  return (ctx: ts.TransformationContext) => {
    return (sourceFile: ts.SourceFile) => {
      function visitor(node: ts.Node): ts.Node {
        if (ts.isCallExpression(node)) {
          if (ts.isIdentifier(node.expression) && node.expression.text === 'loadFileStaticallyFromNPM'
          ) {
            if (node.arguments[0] === undefined) throw new Error(`function loadFileStaticallyFromNPM requires 1 argument at ${sourceFile.fileName}: ${node.expression.getText()}`);
            const npmPath = node.arguments[0].getText().replace(/'|"/g, '');
            // const filePath = require.resolve(npmPath); <-- ERR_PACKAGE_PATH_NOT_EXPORTED
            const filePath = path.join('node_modules', npmPath);
            const content = readFileSync(filePath, 'utf-8');
            return ctx.factory.createStringLiteral(content);
          }
        }
        return ts.visitEachChild(node, visitor, ctx);
      }
      return ts.visitEachChild(sourceFile, visitor, ctx);
    };
  };
}
