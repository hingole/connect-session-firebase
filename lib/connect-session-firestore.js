/**
 * @file Exports the FirestoreStore class
 * @copyright 2017 Ben Weier <ben.weier@gmail.com>
 * @license MIT
 * @version 5.9.0
 */

/**
 * Six hours in milliseconds
 * @private
 */
const reapInterval = 21600000;

/**
 * Noop default reap callback function.
 * @return {this} The function scope.
 * @private
 */
const reapCallback = function reapCallback () {
  return this;
};

/**
 * Return Firebase session store extending Connect/Express session store.
 *
 * @module
 * @param  {Object} session Connect/Express Session Store
 * @return {Function}       FirebaseStore class
 */
const connectSessionFirestore = function connectSessionFirestore (session) {

  /**
   * Connect Store
   * @private
   */
  const Store = session.Store;

  /**
   * Create a new FirebaseStore.
   *
   * @constructor
   * @param {Object} args The configuration options for FirebaseStore
   */
  const FirestoreStore = function FirestoreStore (args) {
    const options = Object.assign({}, args);
    const firestoreDb = options['firestoreDb'] ? options['firestoreDb'] : null;
    const sessions = typeof options.sessions === 'string' ? options.sessions : 'sessions';

    Store.call(options);

    /**
     * Replace disallowed characters in a Firebase reference key.
     *
     * @inner
     * @param  {String} str A child reference key
     * @return {String}     A valid child reference key
     */
    this.cleanRef = function cleanRef (str) {
      return str.replace(/\.|\$|#|\[|\]|\//g, '_');
    };

    // Set a child reference to the sessions path.
    this.sessions = this.cleanRef(sessions);

    // Initialized `firebase` instance.
    if (firestoreDb) {
      this.sessionsCollection = firestoreDb.collection(this.sessions)
    } else {
      throw new Error('Invalid Firestore reference');
    }


    this.reapInterval = options.reapInterval || reapInterval;
    this.reapCallback = options.reapCallback || reapCallback;
    if (typeof this.reapInterval === 'number' && typeof this.reapCallback === 'function') {
      setInterval(this.reap.bind(this, this.reapCallback), this.reapInterval);
    }
  };

  /**
   * Inherit from `Store`
   * @private
   */
  // FirebaseStore.prototype.__proto__ = Store.prototype;
  FirestoreStore.prototype = Object.create(Store.prototype);

  /**
   * Fetch a keyed session reference.
   *
   * @param {String} sid  The session key
   * @param {Function} fn OnComplete callback function
   * @return {Promise}    A thenable Firebase reference
   */
  FirestoreStore.prototype.get = function get (sid, fn) {
    const key = this.cleanRef(sid);
    const now = Date.now();
    const session = this.sessionsCollection.doc(key);

    return session.get()
      .then(doc => {
        if (!doc.exists) {
          return fn();
        }

        if (doc.data().expires < now) {
          return this.destroy(sid, fn);
        }

        const sess = doc.data().sess.toString();

        return fn(null, JSON.parse(sess));
      })
      .catch(fn);
  };

  /**
   * Save a keyed session reference.
   *
   * @param  {String} sid  The session key
   * @param  {Object} sess The session data
   * @param  {Function} fn OnComplete callback function
   * @return {Promise}     A thenable Firebase reference
   */
  FirestoreStore.prototype.set = function set (sid, sess, fn) {
    const key = this.cleanRef(sid);
    const now = Date.now();
    const expires = sess.cookie && typeof sess.cookie.maxAge === 'number' ? now + sess.cookie.maxAge : now + reapInterval;
    const session = this.sessionsCollection.doc(key);

    const data = {
      expires: expires,
      sess: JSON.stringify(sess),
      type: 'connect-session'
    };

    return session.set(data).then(fn).catch(fn);
  };

  /**
   * Remove a keyed session reference.
   *
   * @param  {String} sid  The session key
   * @param  {Function} fn OnComplete callback function
   * @return {Promise}     A thenable Firebase reference
   */
  FirestoreStore.prototype.destroy = function destroy (sid, fn) {
    const key = this.cleanRef(sid);
    const session = this.sessionsCollection.doc(key);

    return session.delete().then(fn).catch(fn);
  };

  /**
   * Remove all session references.
   *
   * @param  {Function} fn OnComplete callback function
   * @return {Promise}     A thenable Firebase reference
   */
  FirestoreStore.prototype.clear = function clear (fn) {
    throw new Error('clear method not implemented');
  };

  /**
   * Remove all expired session references.
   *
   * @param  {Function} fn OnComplete callback function
   * @return {Promise}     A thenable Firebase reference
   */
  FirestoreStore.prototype.reap = function reap (fn) {
    throw new Error('reap method not implemented');
  };

  /**
   * Update a keyed session reference.
   *
   * @param  {String} sid  The session key
   * @param  {Object} sess The session data
   * @param  {Function} fn OnComplete callback function
   * @return {Promise}     A thenable Firebase reference
   */
  FirestoreStore.prototype.touch = function touch (sid, sess, fn) {
    const key = this.cleanRef(sid);
    const session = this.sessionsCollection.doc(key);

    return session.get().then(doc => {
        if (!doc.exists) {
          return fn();
        }

        const touched = Object.assign(
          {},
          JSON.parse(doc.data().sess),
          { cookie: sess.cookie }
        );

        return this.set(sid, touched, fn);
      })
      .catch(fn);
  };

  return FirestoreStore;
};

module.exports = connectSessionFirestore;
