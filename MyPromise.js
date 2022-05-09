/*
https://www.youtube.com/watch?v=1l4wHWQCCIc&ab_channel=WebDevSimplified
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields
https://github.com/WebDevSimplified/js-promise-library/blob/main/MyPromise.js
*/ 
// Create constant variable STATE
const STATE = {
  FULFILLED: "fulfilled",
  REJECTED: "rejected",
  PENDING: "pending",
}

class MyPromise {
  #thenCbs = []                                 // define the callback to be empty array, run if STATE.FULFILLED
  #catchCbs = []                                // define the catch callback to be empty array, run if STATE.REJECTED
  #state = STATE.PENDING                        // state variable: PENDING, REJECTED, FULFILLED. Start out with Pending and change state in onSuccess and onFail
  #value                                        // contains value for onSuccess and on onFail
  #onSuccessBind = this.#onSuccess.bind(this)   // for chaining, hook this by binding to the function. Make sure the "this" keyword is properly hooked up in runCallbacks
  #onFailBind = this.#onFail.bind(this)         

  // every time we create a Promise, it calls the function you passed to it right away 
  constructor(cb) {
    // inside the try-catch, if there is any error in the promise, it we just catch the error and call the failed method
    try {
      // two method: one success a on failure
      cb(this.#onSuccessBind, this.#onFailBind) // #onSuccessBind≈>resolve, this.#onFailBind≈>reject. # - Private method that is not outside the class
    } catch (e) {
      this.#onFail(e)                           // # - Private method that is not outside the class
    }
  }

  #runCallbacks() {
    if (this.#state === STATE.FULFILLED) {    // onSuccess ran
      this.#thenCbs.forEach(callback => {     // forEach callback 
        callback(this.#value)
      })

      this.#thenCbs = []                      // reset to empty for next time
    }

    if (this.#state === STATE.REJECTED) {     // onFail ran
      this.#catchCbs.forEach(callback => {
        callback(this.#value)
      })

      this.#catchCbs = []                     // reset to empty for next time
    }
  }

  // Method for constructor. # - Private method that is not outside the class
  #onSuccess(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) return // We only want to do this one time, not repeatedly

      if (value instanceof MyPromise) {         // if we have a Promise being returned from another promise, we need to wait for this promise to resolve and then call success
        value.then(this.#onSuccessBind, this.#onFailBind)
        return
      }

      this.#value = value
      this.#state = STATE.FULFILLED
      this.#runCallbacks()
    })
  }

  // Method for constructor. # - Private method that is not outside the class
  #onFail(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) return // We only want to do this one time, not repeatedly

      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBind, this.#onFailBind) // if we have a Promise being returned from another promise, we need to wait for this promise to resolve and then call fail
        return
      }

      if (this.#catchCbs.length === 0) { // this means we have an error but we have no catch catching the error, means we have a problem
        throw new UncaughtPromiseError(value)
      }

      this.#value = value
      this.#state = STATE.REJECTED
      this.#runCallbacks()
    })
  }

  then(thenCb, catchCb) {
    // Chaining 
    return new MyPromise((resolve, reject) => {

      // thenCbs
      this.#thenCbs.push(result => {
        if (thenCb == null) {
          resolve(result)
          return                               // 如果thenCbs里没有东西(没有onSuccess)，return null
        }
        // 但如果thenCbs里有东西
        try {
          resolve(thenCb(result))              // if you returns a value pass that value on
        } catch (error) {
          reject(error)
        }
      })

      // catchCbs 和上述很相似
      this.#catchCbs.push(result => {
        if (catchCb == null) {
          reject(result)
          return
        }
        // 但如果catchCbs里有东西
        try {
          resolve(catchCb(result))
        } catch (error) {
          reject(error)
        }
      })

      this.#runCallbacks()
    })
  }

  catch(cb) {
    return this.then(undefined, cb) // pass nothing for the then callback
  }

  finally(cb) { // this never gets value pass into it
    return this.then(
      result => {
        cb()
        return result
      },
      result => { // for failure
        cb()
        throw result
      }
    )
  }

  // implement static methods
  static resolve(value) {
    return new Promise(resolve => {
      resolve(value)
    })
  }

  static reject(value) {
    return new Promise((resolve, reject) => {
      reject(value)
    })
  }

  /*
  The all static method 
  input: array of promise
  output: 
  description:
    Promise.all(p1, p2, p3).then([v1, v2, v3]).catch(e => ), catch if we have a single error in any of our promises
  */
  static all(promises) {
    const results = []                                    // store results
    let completedPromises = 0                             // count the # of promises completed
    // new Promise
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {         // for each promise
        const promise = promises[i]
        promise
          .then(value => {
            completedPromises++
            results[i] = value                             // when any of the promise finishes, set the result at that position
            if (completedPromises === promises.length) {   // when complete all promises
              resolve(results)                             // send out value   
            }
          })  
          .catch(reject)                                   // if any of the promise failed, we just want to take the 1st one that fails and call catch with resolve
      }
    })
  }

  /*
  The allSettled static method 
  input: array of promise
  output: result no matter the promise succeed/failed
  description:
    Promise.allSettled(p1, p2, p3).then([v1, v2, v3])
  */
  static allSettled(promises) {
    const results = []
    let completedPromises = 0
    return new MyPromise(resolve => {                       // ,reject was not used in this method, b/c it never reject 
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i]
        promise
          .then(value => {
            results[i] = { status: STATE.FULFILLED, value } // fullfiled, store value
          })
          .catch(reason => {
            results[i] = { status: STATE.REJECTED, reason } // rejected, with reason that the promise failed 
          })
          .finally(() => {                                  // 
            completedPromises++                             // increment count of completed promises
            if (completedPromises === promises.length) {    // check if all promise finished
              resolve(results)
            }
          })
      }
    })
  }

  /*
  The race static method 
  input: array of promise
  output: returnes first promise which succeed/failed, dont care about saving the promises
  description:
  */
  static race(promises) {
    return new MyPromise((resolve, reject) => {
      promises.forEach(promise => {                         // loop each of them
        promise.then(resolve).catch(reject)                 // get the first and call the method for it => ignore the rest 
      })
    })
  }

  /*
  The any static method 
  input: array of promise
  output: returnes first promise which succeed, but it doesn't return on failed promise unless every promise is failed, then it will reture failure
  description:
    similar to the all static method, but in reverse
  */
  static any(promises) {
    const errors = []
    let rejectedPromises = 0
    return new MyPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i]
        promise 
        .then(resolve)                                                        // if any succeed 
        .catch(value => {                                   
          rejectedPromises++
          errors[i] = value                                                   // save the failed value 
          if (rejectedPromises === promises.length) {                         // all promise failed
            reject(new AggregateError(errors, "All promises were rejected"))  // throw an error 
          }
        })
      }
    })
  }
}

class UncaughtPromiseError extends Error {
  constructor(error) {
    super(error)

    this.stack = `(in promise) ${error.stack}`
  }
}

module.exports = MyPromise
