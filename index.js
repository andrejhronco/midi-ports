/**
   * MIDI device port (input & output) properties [name, ID, manufacturer]
   * @function
   * @param {Object} midi - MIDI access object
   * @returns {Object} Port map of device properties' port (input & output) properties [name, ID, manufacturer]
   */
function getPorts(midi) {
  let portMap = {}

  midi.inputs.forEach(function(device) {
    portMap[format(device.name)] = {
      'name': device.name,
      'inputID': format(device.id),
      'manufacturer': format(device.manufacturer)
    }
  })

  midi.outputs.forEach(function(device) {
    if (portMap[format(device.name)]) portMap[format(device.name)]['outputID'] = format(device.id)
  })

  return portMap;
}

/**
 * MIDI device ports allowed for this App.
 * @function
 * @param {Array} deviceNames - array of MIDI devices derived from source
 * @param {Object} ports - Port map of device properties
 * @param {Object} source - chosen MIDI device list
 * @returns {Object} devices with port data
 */
function buildDevices(deviceNames, ports, source) {
  let props = ['name', 'inputID', 'outputID', 'manufacturer']

  if (!Object.keys(source).length) source = Object.assign({}, ports)
    /**
     * @let {Array} devices - copied source devices
     */
  let devices = Object.assign({}, source), 
      notfound = []

  // build devices
  deviceNames.forEach(function(device) {
    Object.keys(ports).forEach(function(port) {
        if (devices[device][port]) {
          props.forEach(function(prop) {
            devices[device][port][prop] = ports[port][prop]
          })
        }
      })
    // populate notfound with port
    Object.keys(devices[device]).forEach(function(port) {
      if (!Object.keys(devices[device][port]).length) {
        notfound.push(port)
      }
    })
  })
  // remove notfound ports from devices
  if (notfound.length) {
    Object.keys(devices).forEach(function(device) {
      Object.keys(devices[device]).forEach(function(port){
        if(notfound.includes(port)) delete devices[device]
      })
    })
  }

  return {
   devices: devices,
   notfound: notfound
  }
}

/**
 * Builds MIDI devices object with all port (input & output) properties [name, ID, manufacturer]
 * @function
 * @param {Object} midi - MIDI access object
 * @param {Object} sourceDevices - initial MIDI devices
 * @returns {Function} Allowing access to midi access object, ports, device object, and notfound
 */
function midiPorts(midi, source = {}) {
  let collections = {
    'access': {},
    'ports': {},
    'devices' :{},
    'notfound' : []
  }

  /**
   * @let {Array} deviceNames - desired device names
   */
  let deviceNames = Object.keys(source)

  /**
   * {Object} midiAccess - midi access object from successful request
   */
  collections.access = midi

  /**
   * {Object} ports - device ports (input & output) with properties [name, ID, manufacturer]
   */
  collections.ports = getPorts(midi)

  /**
   * @let {Object} built - All MIDI devices with port [name, ID, manufacturer] properties, notfound devices
   */
  let built = buildDevices(deviceNames, collections.ports, source)
  collections.devices = built.devices
  collections.notfound = built.notfound
  
  /**
  * Returns midi access object, ports, device object, and notfound
  * @Function
  * param {String} 'access', 'midi', 'notfound', or 'device:port' to get props from
  * @example
  * // returns device object
  * ports('devices')
  * @example
  * // returns full midi access object
  * ports('access')
  * @example
  * // returns midi inputs Iterator
  * ports('midi').get('inputs')
  * @example
  * // returns Boolean if desired / allowed ports are not found
  * ports('notfound')
  */
 
  return function(device = 'midi') {
    // tests
    let isAccess = (device === 'access'.toLowerCase()) ? true : false,
        isMIDI = (device === 'midi'.toLowerCase()) ? true : false,
        isDevices = (device === 'devices'.toLowerCase()) ? true : false,
        isPorts = (device === 'ports'.toLowerCase()) ? true : false,
        isNotFound = (device === 'notfound'.toLowerCase()) ? true : false,
        notFound = (collections.notfound.length) ? true : false,
        isDevicePort = (!isAccess && device.toLowerCase().includes(':')) ? true : false,
        inDevices = (device in collections.ports || device in collections.devices) ? true : false;
    // device:port
    let dvc = (isDevicePort) ? device.split(':') : device,
        inDevicesPort = (isDevicePort && collections.devices[dvc[0]] && dvc[1] in collections.devices[dvc[0]]) ? true : false;

    if (isPorts) {
      return collections.ports
    } else if (isDevices) {
      return collections.devices
    } else if (isAccess) {
      return collections.access
    } else if(isNotFound){
      if(notFound){
        return collections.notfound
      } else {
        return false
      }
    }
    /**
    * Returns object with get and set methods, set supports chaining
    * @Object
    */
    return {
      /**
      * param {String} property from device, midi, or device object 
      * @example
      * // returns device input object
      * ports('k-board').get('input')
      * @example
      * // sets property on device object
      * ports('k-board').set('quality', 'great!')
      * @example
      * // returns property value [name, manufacturer, custom]
      * ports('k-board').get('quality'))
      */
      get: function get(property) {
        if (!property) return

        let prop,
            isIO = (property.includes('input') || property.includes('output')),
            inputType = (isIO && property.includes('input')) ? 'inputs' : 'outputs',
            suffix = (isIO && !isMIDI) ? 'ID' : '';
        
        if (isMIDI && !!collections.access[property]) {
          prop = collections.access[property]
        } else if (isDevicePort && inDevicesPort) { // device:port
          if (isIO) {
            prop = collections.access[inputType].get(collections.devices[dvc[0]][dvc[1]][property + suffix])
          } else {
            prop = collections.devices[dvc[0]][dvc[1]][property]
          }
        } else if (!isDevicePort && inDevices) { // 'port'
          if (isIO) {
            if (!!collections.devices[dvc] && !!collections.devices[dvc][dvc]) { // device:device exists
              prop = collections.access[inputType].get(collections.devices[dvc][dvc][property + suffix])
            } else if(!!collections.devices[dvc]){
              prop = collections.access[inputType].get(collections.devices[dvc][property + suffix])
            } else if(!!collections.ports[dvc]){
              prop = collections.access[inputType].get(collections.ports[dvc][property + suffix])
            } else {
              console.warn('port '+ device +' not found')
            }
          } else {
            if (!!collections.devices[dvc][dvc]) {
              prop = collections.devices[dvc][dvc][property]
            } else {
              prop = collections.devices[dvc][property]
            }
          }
        } else {
          console.warn('port '+ device +' not found')
        }
        
        return prop
      },
      /**
      * param {String} property to be set
      * param {String} property value to be set
      * @example
      * // sets property on device object
      * ports('k-board').set('quality', 'great!')
      * @example
      * // returns property value [name, manufacturer, custom]
      * ports('k-board').get('quality'))
      */
      set: function set(property, value) {
        if(isDevicePort && !!collections.devices[dvc[0]][dvc[1]]){
          collections.devices[dvc[0]][dvc[1]][property] = value
        } else if(inDevices){
          if(!!collections.devices[device][device]){
            collections.devices[device][device][property] = value
          } else {
            collections.devices[device][property] = value
          }
        } else {
          console.warn('port '+ device +' not found')
        }
        return this
      }
    }
  }
}

/**
 * Formats string to remove spaces and convert to lowercase
 * @function
 * @param {String} string to format
 * @returns {String} formatted string
 */
function format(string) {
  return string.toLowerCase().replace(/\s/g, '-').replace(',', '')
}

module.exports = midiPorts