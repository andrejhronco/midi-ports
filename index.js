/**
 * MIDI device port (input & output) properties [name, ID, manufacturer]
 * @function
 * @param {Object} midi - MIDI access object
 * @returns {Object} Port map of device properties' port (input & output) properties [name, ID, manufacturer]
 */
function getPorts(midi){
	var portMap = {}
	
	midi.inputs.forEach(function(device){
		portMap[format(device.name)] = { 
			'name': device.name, 
			'inputID': format(device.id), 
			'manufacturer': format(device.manufacturer) }
	})

	midi.outputs.forEach(function(device){
		portMap[format(device.name)]['outputID'] = format(device.id)
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
function buildDevices(deviceNames, ports, source){
	var props = ['name', 'inputID', 'outputID', 'manufacturer']

	if(!Object.keys(source).length) source = Object.assign({}, ports)
	/**
	 * @var {Array} devices - copied source devices
	 */
	var devices = Object.assign({}, source)

	deviceNames.forEach(function(device){
		Object.keys(ports).forEach(function(port){
			if(devices[device][port]) {
				props.forEach(function(prop){
					devices[device][port][prop] = ports[port][prop]
				})
			}
		})
	})

	return devices
}

/**
 * Final MIDI devices object with all port (input & output) properties [name, ID, manufacturer]
 * @function
 * @param {Object} midi - MIDI access object
 * @param {Object} sourceDevices - initial MIDI devices
 * @returns {Object} All MIDI devices with port [name, ID, manufacturer] properties
 */
function midiPorts(midi, source = {}){
	/**
	* @var {Array} deviceNames - desired device names
	*/ 
	var deviceNames = Object.keys(source)

	/**
	* @var {Object} ports - device ports (input & output) with properties [name, ID, manufacturer]
	*/ 
	var ports = getPorts(midi)
	
	/**
	* @var {Object} devices - All MIDI devices with port [name, ID, manufacturer] properties
	*/ 
	var devices = buildDevices(deviceNames, ports, source)

	return devices;
}

function format(string){
	return string.toLowerCase().replace(/\s/g, '-').replace(',','')
}

//export { midiPorts as default };

module.exports = midiPorts
