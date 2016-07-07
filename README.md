#midi-ports

Returns an object of attached **web midi** ports with inputID, outputID, name, and manufactuer for more symantic MIDI port access.

##install
```javascript
npm install midi-ports --save
```
##usage
```javascript
import midiPorts from 'midi-ports'

let midi, ports;

navigator.requestMIDIAccess({sysex: true})
	.then((midiAccess) => {
		midi = midiAccess
		ports = midiPorts(midi [,options])
	})
/*
ports =>
{
	'k-mix-audio-control': {
		name: 'K-Mix Audio Control',
		inputId: '-543473823',
		outputId: '586923498',
		manufacturer: 'Keith McMillen Instruments'
	},
	'k-mix-control-surface': {
		name: 'K-Mix Control Surface',
		inputId: '-543345892',
		outputId: '654298746',
		manufacturer: 'Keith McMillen Instruments'
	}
}
*/
```
Which enables port access by name:

```javascript
let kmixInput = midi.inputs.get(ports['k-mix-control-surface'].inputID)
kmixInput.onmidimessage = (e) => console.log('data', e.data)

// or

let kmixOutput = midi.outputs.get(ports['k-mix-audio-control'].outputID)
kmixOutput.send([176, 1, 64])
```

##Allowed Devices
An optional object can be passed in to only gather data of desired devices and midi ports. All other attached devices and  ports will be ignored. 

This is especially useful if multiple MIDI devices are attached to the system and you want easy access to each port.

```javascript
let allowed = {
	'k-mix': {
		'k-mix-audio-control': { },
		'k-mix-control-surface': { },
		'icon': 'https://files.keithmcmillen.com/products/k-mix/icons/k-mix.svg',
		'manufacturer': 'Keith McMillen Instruments'
	}
}

let devices = midiPorts(midi, allowed)
/*
 => 
 {
	'k-mix': {
		'k-mix-audio-control': {
			name: 'K-Mix Audio Control',
			inputID: '-543473823',
			outputID: '586923498',
			manufacturer: 'Keith McMillen Instruments'
		},
		'k-mix-control-surface': {
			'name': 'K-Mix Control Surface',
			inputID: '-543345892',
			outputID: '654298746',
			manufacturer: 'Keith McMillen Instruments'
		},
		'icon': 'https://files.keithmcmillen.com/products/k-mix/icons/k-mix.svg',
		'manufacturer': 'Keith McMillen Instruments'
	}
}
*/

let kmixOutput = midi.outputs.get(devices['k-mix']['k-mix-audio-control'].outputID)

kmixOutput.send([240, 126, 127, 6, 1, 247])
```
##Error Handling
New in 1.1.0.
If you're passing in an 'allowed devices' object and that device is not connected/found, midi-ports will add a property called 'notfound' populated with not found device names allowing for easy error handlng. Additionally, a 'ports' property with _*all*_ connected ports will be added as well, allowing you setup fallback ports if desired.

In the case above, if 'k-mix' is not connected/found, midi-ports will return an object like this:

```javascript
/*
ports =>
{
	'notfound': ['k-mix'],
	'ports: {
		'k-board': {
			inputID: "1852960744",
			manufacturer: "kesumo-llc",
			name: "K-Board",
			outputID: "-162522465"
		}
	}
}
*/
```
Which makes it easy to use alternative ports if your desired port isn't connected/found:

```javascript
if(ports['notfound']){
	console.log('Device ' + ports['notfound'][0] + ' not found)
	
	// use a port from ports[ports]
	...
}
```