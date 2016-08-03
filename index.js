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
  let devices = Object.assign({}, source)

  devices.notfound = []
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
        devices.notfound.push(port)
      }
    })
  })
  // remove notfound ports
  if (devices.notfound.length) {
    Object.keys(devices).forEach(function(device) {
    	if(device !== 'notfound'){
	    	Object.keys(devices[device]).forEach(function(port){
        	if(devices.notfound.includes(port)) delete devices[device]
      	})
      }  
    })
    // if a device is not found add all ports
    devices.ports = ports
  } else {
    delete devices.notfound
  }

  return devices
}

/**
 * Builds MIDI devices object with all port (input & output) properties [name, ID, manufacturer]
 * @function
 * @param {Object} midi - MIDI access object
 * @param {Object} sourceDevices - initial MIDI devices
 * @returns {Function} Allowing access to midi access object, ports, device object, and notfound
 */
function midiPorts(midi, source) {
  source = source || {}
    /**
     * @let {Array} deviceNames - desired device names
     */
  let deviceNames = Object.keys(source)

  /**
   * @let {Object} ports - device ports (input & output) with properties [name, ID, manufacturer]
   */
  let ports = getPorts(midi)

  /**
   * @let {Object} devices - All MIDI devices with port [name, ID, manufacturer] properties
   */
  let devices = buildDevices(deviceNames, ports, source)

  devices.access = midi
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
        isNotFound = (device === 'notfound'.toLowerCase()) ? true : false,
        notFound = (devices['notfound'] && devices['notfound'].length) ? true : false,
        isDevicePort = (!isAccess && device.toLowerCase().includes(':')) ? true : false,
        inDevices = (device in devices) ? true : false;
    // device:port
    let dvc = (isDevicePort) ? device.split(':') : device,
        inDevicesPort = (isDevicePort && dvc[1] in devices[dvc[0]]) ? true : false;

    if (isDevices) {
      let devicesNoAccess = Object.assign({}, devices)
      delete devicesNoAccess.access
      return devicesNoAccess
    } else if (isAccess) {
      return devices.access
    } else if(isNotFound){
      if(notFound){
        return devices['notfound']
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
        
        if (isMIDI && !!devices.access[property]) {
          prop = devices.access[property]
        } else if (isDevicePort && inDevicesPort) { // device:port
          if (isIO) {
            prop = devices.access[inputType].get(devices[dvc[0]][dvc[1]][property + suffix])
          } else {
            prop = devices[dvc[0]][dvc[1]][property]
          }
        } else if (!isDevicePort && inDevices) { // 'port'
          if (isIO) {
            if (!!devices[dvc][dvc]) { // device:device exists
              prop = devices.access[inputType].get(devices[dvc][dvc][property + suffix])
            } else {
              prop = devices.access[inputType].get(devices[dvc][property + suffix])
            }
          } else {
            if (!!devices[dvc][dvc]) {
              prop = devices[dvc][dvc][property]
            } else {
              prop = devices[dvc][property]
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
        if(isDevicePort && !!devices[dvc[0]][dvc[1]]){
          devices[dvc[0]][dvc[1]][property] = value
        } else if(inDevices){
          if(!!devices[device][device]){
            devices[device][device][property] = value
          } else {
            devices[device][property] = value
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