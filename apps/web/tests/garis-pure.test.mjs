// F2-004: vite.config.ts tells the bundler that the Garis components and icons (src/components/garis, icons) do
// nothing when imported, so a page importing one through the library's index doesn't carry every other one before its
// first render. This keeps that true: no bare import (`import './x.css'`) and no top-level statement that runs
// something (a call, an assignment, a listener); only imports, exports, declarations and types.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../src/components');
const files = ['garis', 'icons', 'push'].flatMap((dir) =>
  fs
    .readdirSync(path.join(root, dir))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => path.join(root, dir, f)),
);

/** Whether an expression can run anything when evaluated (a call, `new`, an assignment, a tagged template). */
function runs(node) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    // Code inside a function runs only when called.
    if (
      ts.isArrowFunction(n) ||
      ts.isFunctionExpression(n) ||
      ts.isMethodDeclaration(n) ||
      ts.isClassDeclaration(n)
    )
      return;
    if (
      ts.isCallExpression(n) ||
      ts.isNewExpression(n) ||
      ts.isTaggedTemplateExpression(n) ||
      (ts.isBinaryExpression(n) &&
        n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        n.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
    ) {
      // React's definition helpers (`lazy` only records how to load), reading an object's keys, an empty Set or Map,
      // and the toast store's factory (closures over its own state) build values and touch nothing outside.
      const text = n.getText();
      if (
        /^(forwardRef|memo|lazy|createContext|Symbol|Object\.(freeze|keys)|createToastStore)(<[^(]*>)?\(|^new (Set|Map)\b/.test(
          text,
        )
      )
        return;
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

test('the Garis components and icons have no import-time effects', () => {
  assert.ok(files.length > 40, 'found the component files');
  const problems = [];
  for (const file of files) {
    const src = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    for (const st of src.statements) {
      const where = `${path.relative(root, file)}:${src.getLineAndCharacterOfPosition(st.getStart()).line + 1}`;
      if (ts.isImportDeclaration(st)) {
        if (!st.importClause) problems.push(`${where} bare import`);
        continue;
      }
      if (
        ts.isExportDeclaration(st) ||
        ts.isFunctionDeclaration(st) ||
        ts.isInterfaceDeclaration(st) ||
        ts.isTypeAliasDeclaration(st)
      )
        continue;
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations)
          if (d.initializer && runs(d.initializer))
            problems.push(`${where} ${d.name.getText()} runs code`);
        continue;
      }
      if (ts.isExportAssignment(st) && !runs(st.expression)) continue;
      problems.push(`${where} ${ts.SyntaxKind[st.kind]}`);
    }
  }
  assert.deepEqual(problems, []);
});
