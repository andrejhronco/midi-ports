#midi-ports
Builds an object of MIDI devices with name, inputID, outputID, and manufacturer and wraps the MIDI Access object to allow a more symantic way of interacting with MIDI devices.

##install
```javascript
npm install midi-ports --save
```
##usage
```javascript
import midiPorts from 'midi-ports'

let midi, ports;

navigator.requestMIDIAccess({sysex: true}) // set to true if you need to send sysex messages
	.then((midiAccess) => {
		midi = midiAccess
		ports = midiPorts(midi [,options])
	})
/*
internally builds a devices/ports object:

ports('devices') =>
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
// get an input and listen for messsages
let kmixInput = ports('k-mix-control-surface').get('input')
kmixInput.onmidimessage = (e) => console.log('data', e.data)

// or, get an output and send messages
let kmixOutput = ports('k-mix-control-surface').get('output')
kmixOutput.send([176, 1, 64])
```

##Allowed Devices
An optional object can be passed in to only gather data of desired devices and midi ports. All other attached devices and ports will be ignored. * see error handling below

This is especially useful if multiple MIDI devices are attached to the system and you want easy access to a specific port.

The allowed devices object should be formated:

```javascript
let allowed = {
	'device': {
		'port-name': { }, // empty object which gets populated with name, inputID, outputID, and manufacturer
		'other-info': 'this can be any info you want to reference'
	}
}
```

*Port names must be lowercase and hyphen-separated.

```javascript
let allowed = {
	'k-mix': {
		'k-mix-audio-control': { },
		'k-mix-control-surface': { },
		'icon': 'https://files.keithmcmillen.com/products/k-mix/icons/k-mix.svg',
		'manufacturer': 'Keith McMillen Instruments'
	},
	'k-board':{
		'k-board': { },
		'icon': 'https://files.keithmcmillen.com/products/k-board/icons/k-board.svg',
		'manufacturer': 'Keith McMillen Instruments'
	}
}
//...
let devices = midiPorts(midi, allowed)
/*
internally builds a devices.ports object:

ports('devices') => 
 {
	'k-mix': {
		'k-mix-audio-control': {
			name: 'K-Mix Audio Control',
			inputID: '-543473823',
			outputID: '586923498',
			manufacturer: 'keith-mcmillen-instruments'
		},
		'k-mix-control-surface': {
			'name': 'K-Mix Control Surface',
			inputID: '-543345892',
			outputID: '654298746',
			manufacturer: 'keith-mcmillen-instruments'
		},
		'icon': 'https://files.keithmcmillen.com/products/k-mix/icons/k-mix.svg',
		'manufacturer': 'Keith McMillen Instruments'
	},
	'k-board':{
		'k-board': {
			name:'K-Board',
			inputID:'1852960744',
			outputID:'-162522465',
			manufacturer:'kesumo-llc'
		},
		'icon': 'https://files.keithmcmillen.com/products/k-board/icons/k-board.svg',
		'manufacturer': 'Keith McMillen Instruments'
	}
}
*/
```
To access grouped devices, use the 'device:port-name' format 

```javascript
let kmixOutput = devices('k-mix:k-mix-audio-control').get('output')

kmixOutput.send([240, 126, 127, 6, 1, 247])
```
_*Grouped Devices*_
If a device in your allowed devices object only has one port that has the same name as your device, you can use a shorthand for getting that port.

```javascript
	// you can use either
	devices('k-board:k-board').get('input') // => MIDIInput
	// or, the shorter
	devices('k-board').get('input') // => MIDIInput
```

##Accessing MIDIAccess and The Device Object
You can also get direct access to the MIDIAccess object, including 'inputs' and 'outputs', and device object.

```javascript
//...
let devices = midiPorts(midi, allowed)
// get device object, a la midi-ports v.1.x
devices('devices') // => {'device': 'port-name': { ... }}
// get MIDI Access object
devices('access') // => MIDIAccess
// get MIDI Access inputs / outputs iterator
// ** when getting inputs / outputs from the MIDI Access object you must use the 'midi' param
devices('midi').get('inputs') // => MIDIInputMap
// if using allowed devices object and a device isn't found ** see Error Handling below
devices('notfound') // => array of notfound ports ['k-mix-audio-control','k-mix-control-surface']
```

##Setting / Getting data
You can also set arbitrary port-specific data using the set method. Set and Get can be chained.

```javascript
let devices = midiPorts(midi)
devices('k-board').set('quality', 'great!')
// get custom data
devices('k-board').get('quality') // => great!
// chain set and get
devices('k-board').set('price', '$99').set('review', 'awesome!').get('review') // => 'awesome!'
```

##Error Handling

If you're passing in an 'allowed devices' object and that device is not connected/found, midi-ports will add a each not-found port to an internal list, allowing for easy error handlng. Additionally, a 'ports' property with _*all*_ connected ports will be added as well, allowing you setup fallback ports if desired.

In the case above, if 'k-mix' is not connected/found, querying 'devices' will return an object like this:

```javascript
/*
ports('devices') =>
{
	'notfound': ['k-mix-audio-control','k-mix-control-surface'],
 	'k-board': {
   	 	name: "K-Board",
    	inputID: "1852960744",
    	outputID: "-162522465",
    	manufacturer: "kesumo-llc"
	},
	'ports: {
		'k-board': {
			name: "K-Board",
			inputID: "1852960744",
			outputID: "-162522465",
			manufacturer: "kesumo-llc"
		}
	}
}
*/
```
Which makes it easy to use alternative ports if your desired port isn't connected/found:

```javascript
if(ports('notfound').length){
	console.log('Device ' + ...ports('notfound') + ' not found)
	
	// use an alternate port from ports('devices').ports
	// ...
}
```