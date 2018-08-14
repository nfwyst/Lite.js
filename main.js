{
  let w = typeof self === 'undefined' ? global : self;
  let doc = typeof document === 'undefined' ? null : document;
  let parseSelector = Symbol('parseSelector');
  let parseTagName = Symbol('parseTagName');
  let getSetContent = Symbol('getSetContent');
  let insert = Symbol('insert');

  class Base extends Array {
    constructor(...props) {
      super();
      this.selector = '';
      this.init(...props);
    }

    init(selector) {
      if(typeof selector === 'function') {
        Lite.ready(selector);
      } else if(selector instanceof Array) {
        [...selector].forEach(item => {
          this.push(item);
        });
      } else if(typeof selector === 'object' && HTMLElement[Symbol.hasInstance](selector)) {
        this.push(selector);
      }
      typeof selector === 'string' && doc && doc.querySelectorAll(selector).forEach((item) => {
        this.push(item);
      });
      return this;
    }

    forEach(fn) {
      for(let i = 0; i < this.length; i++) {
        if (fn(i, this[i])) {
          return true;
        }
      }
      return this;
    }

    static sibling(cur, dir) {
      do {
        cur = cur[dir];
      } while (cur && cur.nodeType !== 1);
      return cur;
    }
  }

  class Lite extends Base {
    constructor(...props) {
      super(...props);
    }

    static ajax(params) {
      let config = {
        type: 'GET',
        url: null,
        data: null,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };
      if(typeof params === 'string') {
        config.url = params;
      } else {
        config = {
          ...config,
          ...params
        };
      }
      const xhr = new XMLHttpRequest();
      return new Promise((resolve, reject) => {
        try {
          xhr.open(config.type, config.url);
          if(config.type === 'POST') {
            for(let [k, v] of Object.entries(config.headers)) {
              xhr.setRequestHeader(k, v);
            }
          }
          xhr.send(config.data);
          xhr.onreadystatechange = () => {
            let data = null;
            let status = xhr.status;
            if(xhr.readyState === 4 && (status >= 200 && status < 300 | status === 304)) {
              try {
                data = w.JSON ? JSON.parse(xhr.responseText) : eval(`(${xhr.responseText})`);
              } catch (err) {
                data = xhr.responseText;
              }
              resolve({
                data,
                status,
                headers: xhr.getAllResponseHeaders().split('\n').reduce((cur, next) => {
                  let [k, v] = next.trim().split(':');
                  v ? cur[k] = v.trim() : null;
                  return cur;
                }, {}),
              });
            }
          };
        } catch (err) {
         reject(err.message);
        }
      });
    }

    static GET(url) {
      if(!url) return null;
      return Lite.ajax({
        url
      });
    }

    static POST(url, data) {
      if(!url) return null;
      if(data) {
        return Lite.ajax({
          type: 'POST',
          url,
          data
        })
      }
      return (data) => {
        return Lite.ajax({
          type: 'POST',
          url,
          data
        });
      }
    }

    static each(els = [], fn = () => {}, context = null) {
      if(els[Symbol.iterator]) {
        let index = 0;
        for(let item of els) {
          if(context) {
            if(fn.call(context, index++, item)) break;
          } else {
            if(fn.call(els, index++, item)) break;
          }
        }
      } else if(Reflect.has(els, 'length')) {
        for(let i = 0; i < els.length; i++) {
          if(context) {
            if(fn.call(context, i, els[i])) break;
          } else {
            if(fn.call(els, i, els[i])) break;
          }
        }
      }
    }

    static ready(fn) {
      fn = ((f) => {
        return function() {
          f && f();
          doc.removeEventListener('DOMContentLoaded', arguments.callee, true);
        }
      })(fn);
      doc.addEventListener('DOMContentLoaded', fn, false);
    }

    hasClass(name) {
      const regexp = new RegExp(`(\\s|^)${name}(\\s|$)`);
      return this.forEach((_, item) => {
        return regexp.test(item.className);
      });
    }

    next() {
      return this.length > 0 ? Base.sibling(this[0], 'nextSibling') : null;
    }

    prev() {
      return this.length > 0 ? Base.sibling(this[0], 'previousSibling') : null;
    }

    get(id) {
      return typeof id === 'number' ? this[id] : null;
    }

    [parseTagName](el) {
      return el ? el.tagName.toLowerCase() || el.nodeName.toLowerCase() || el.localName : null;
    }

    find(selector = '') {
      return w.$(`${this.selector} ${selector}`);
    }

    first() {
      return w.$(this[0]);
    }

    last() {
      let {[this.length - 1]: last} = this;
      return w.$(last);
    }

    eq(id) {
      let pass = typeof id === 'number' && id < this.length;
      if(!pass) return null;
      return w.$(this[id]);
    }

    [parseSelector](el) {
      let tagName = this[parseTagName](el);
      let id = el.id || '';
      let className = el.className ? el.className.split(' ').reduce((cur, next) => {
        return `${cur}.${next}`;
      }, '') : '';

      if(id) {
        return `${tagName}#${id}${className}`;
      } else {
        return `${tagName}${className}`;
      }
    }

    parent(el) {
      if(this.length <= 0 || el && !(el instanceof HTMLElement)) return null;
      let parent = el ? el.parentNode : this[0].parentNode;
      parent = parent && parent.nodeType !== 11 ? parent : null;
      if(!parent) return null;
      let res = w.$();
      res.selector = this[parseSelector](parent);
      res.push(parent);

      return res;
    }

    parents() {
      if(this.length <= 0) return w.$();
      let res = w.$();
      let cur = this[0];
      let el = this.parent(cur);
      while(el && el.length > 0) {
        res.push(el);
        el = this.parent(el);
      }

      return res;
    }

    static parseCssKey(name) {
      return name.replace(/(\w+|^)([A-Z])(\w+|$)/,(_, a, b, c) => {
        return `${a}-${b.toLowerCase()}${c}`;
      });
    }

    attr(attrs = null, val) {
      if(typeof attrs === 'string' && !val) return this[0].getAttribute(attrs);
      if(typeof attrs === 'string' && val) {
        return this.forEach((_, item) => {
          item.setAttribute(attrs, val);
        });
      }
      if(typeof attrs === 'object') {
        let entries = Object.entries(attrs);
        return this.forEach((_, item) => {
          for(let [k, v] of entries) {
            item.setAttribute(k, v);
          }
        });
      }
    }

    data(attrs = null, val) {
      if(typeof attrs === 'string') return this.attr(`data-${attrs}`, val);
      if(typeof attrs === 'object') {
        let entries = Object.entries(attrs);
        for(let [k, v] of entries) {
          this.attr(`data-${k}`, v);
        }
      }
    }

    [getSetContent](type, val) {
      if(val === null) {
        return this.length > 0 ? this[0][type] : null;
      } else {
        return this.forEach((_, item) => {
          item[type] = val;
        });
      }
    }

    [insert](ps, content) {
      return this.forEach((_, item) => {
        item.insertAdjacentElement(ps, content);
      });
    }

    append(str) {
      return this[insert]('beforeend', str);
    }

    after() {
      return this[insert]('afterend', str);
    }

    before() {
      return this[insert]('beforebegin', str);
    }

    html(val = null) {
      return this[getSetContent]('innerHTML', val);
    }

    text(val = null) {
      return this[getSetContent]('innerText', val);
    }

    remove(el = null) {
      if(el === null) {
        return this.forEach((_, item) => {
          item.remove();
        });
      } else if(HTMLElement[Symbol.hasInstance](el)){
        return this.forEach((_, item) => {
          try {
            item.removeChild(el);
          } catch (err) {
            return false;
          }
        });
      }
      return this;
    }

    css(attrs = null, value) {
      if(!attrs && !value) return null;
      if(typeof attrs === 'object') {
        let mps = new Map();
        Object.keys(attrs).forEach(attr => {
          mps.set(Lite.parseCssKey(attr), attrs[attr]);
        });
        return this.forEach((_, item) => {
          for(let [k, v] of mps) {
            item.style[k] = v;
          }
        });
      }
      if(typeof attrs === 'string' && attrs.split(';') > 1) {
        return this.forEach((_, item) => {
          item.style.cssText = attrs;
        });
      }
      if(typeof attrs === 'string' && value) {
        return this.forEach((_, item) => {
          item.style[attrs] = value;
        });
      } else if(typeof attrs === 'string' && !value) {
        return w.getComputedStyle ? getComputedStyle(this[0])[attrs] : this[0].style[attrs];
      }
      return this;
    }
  }

  w.$ = function(selector) {
    return new Lite(selector)
  }

  Reflect.ownKeys(Lite).forEach(item => {
    if (typeof Lite[item] === 'function') {
      w.$[item] = Lite[item];
    }
  });

}

var a = $('div');
