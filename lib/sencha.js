'use babel';

import { CompositeDisposable } from 'atom';

const Promise = require('bluebird'),
    path = require('path'),
    fs = Promise.promisifyAll(require('fs')),
    stripJsonComments = require('strip-json-comments'),
    R = require('ramda');

let workspace;

const isJavascript = (textEditor) => {
    const { scopeName } = textEditor.getGrammar()
    return (scopeName === 'source.js' || scopeName === 'source.js.jsx')
}

function getWorkspace() {
    if (workspace) {
        return Promise.resolve(workspace);
    }
    return Promise.reduce(atom.project.rootDirectories, (cfg, dir) =>
        fs.readFileAsync(path.join(dir.path, 'workspace.json'), 'utf-8')
        .then(ws => {
            workspace = JSON.parse(stripJsonComments(ws));
            workspace.root = dir.path;
            return workspace;
        }), null);
}

function getBootstrap() {
    return getWorkspace()
    .then(ws => {
        const bsRoot = path.join(ws.root, R.head(ws.apps));
        return fs.readFileAsync(
            path.join(bsRoot, 'classic.json'), 'utf-8')
            .then(cfg => {
                cfg = JSON.parse(cfg);
                cfg.root = bsRoot;
                return cfg;
            });
    })
}

function findSenchaPath(s) {
    return getBootstrap()
    .then(bs => {
        let cls = bs.classes[s];
        if (!cls) {
            cls = R.find(
                cls => R.indexOf(s, cls.alternates) !== -1,
                R.values(bs.classes));
        }
        if (cls) {
            return path.join(bs.root, bs.loadOrder[cls.idx].path);
        }
    });
}

function makeProvider(subscriptions) {
    return {
        providerName:'sencha',
        wordRegExp: /^[  ]*$|[^\s\/\\\(\)"':,;<>~!@#\$%\^&\*\|\+=\[\]\{\}`\?\-…]+|[\/\\\(\)"':,;<>~!@#\$%\^&\*\|\+=\[\]\{\}`\?\-…]+/g,
        getSuggestionForWord(textEditor, text, range) {
            if (isJavascript(textEditor)) {
                return findSenchaPath(text)
                .then(filename => {
                    if (filename) {
                        return {
                            range,
                            callback() {
                                atom.workspace.open(filename);
                            }
                        }
                    }
                });
            }
        }
    };
}

module.exports = {
    config: {
        extensions: {
            description: "Comma separated list of extensions to check for when a file isn't found",
            type: 'array',
            default: [ '.js', '.json', '.node' ],
            items: { type: 'string' },
        }
    },
    activate(state) {
        this.subscriptions = new CompositeDisposable();
    },
    getProvider() {
        return makeProvider(this.subscriptions);
    },
    deactivate() {
        this.subscriptions.dispose();
    }
};
