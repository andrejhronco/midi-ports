#midi-ports

Wraps the MIDIAccess object and builds an object of midi devices with name, inputID, outputID, and manufacturer allowing a more semantic way of interacting with midi devices in the browser.

For use with the Web MIDI API, check browser support here: http://caniuse.com/#feat=midi

##install
```javascript
npm install midi-ports --save
```
##usage
```javascript
import midiPorts from 'midi-ports'

let midi, ports;

navigator.requestmidiAccess({sysex: true}) // set to true if you need to send sysex messages
	.then((midiAccess) => {
		midi = midiAccess
		ports = midiPorts(midi [,options])
	})

//internally builds a ports object:
ports('ports') 
/* =>
{
	'k-mix-audio-control': {
		name: 'K-Mix Audio Control',
		inputID: '-543473823',
		outputID: '586923498',
		manufacturer: 'keith-mcmillen-instruments'
	},
	'k-mix-control-surface': {
		name: 'K-Mix Control Surface',
		inputID: '-543345892',
		outputID: '654298746',
		manufacturer: 'keith-mcmillen-instruments'
	}
}
*/
```
Which enables port access by name:

```javascript
// get an input and listen for messages
let kmixInput = ports('k-mix-control-surface').get('input')
kmixInput.onmidimessage = (e) => console.log('data', e.data)

// or, get an output and send messages
let kmixOutput = ports('k-mix-control-surface').get('output')
kmixOutput.send([176, 1, 64])
```

##Grouped Devices
If you want to group ports by device, you can pass in an object as the second param which allows you to get a device:port by name.

The grouped devices object should be formatted:

```javascript
let grouped = {
	'device': {
		'port-name': { }, // empty object which gets populated with name, inputID, outputID, and manufacturer
		'other-info': 'this can be any info you want to reference'
	}
}
```

*Port names must be lowercase and hyphen-separated.

```javascript
let grouped = {
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
let devices = midiPorts(midi, grouped)
/*
internally builds a devices.ports object:

devices('devices') => 
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
If you want to group a device:port with only one port and its name is the same as the device, you can use a shorthand for getting that port.

```javascript
	// you can use either
	devices('k-board:k-board').get('input') // => midiInput
	
	// or, the shorter
	devices('k-board').get('input') // => midiInput
```

##Accessing midiAccess The Ports Object, and the Devices Object
You can get direct access to the midiAccess object from within midi-ports, for example, to set a statechange handler, or loop over the 'ports' or 'devices' objects.

If you're not passing in an grouped devices object, 'ports' and 'devices' reference the same object, otherwise, 'devices' is in the format of grouped devices, 'device.port-name'. 

The 'ports' object is always available and includes *_ALL_* attached ports.

```javascript
let devices = midiPorts(midi, grouped)

// get ports object, a la midi-ports v.1.x
devices('ports') // => {'port-name': { ... }}

// get device object, a la midi-ports v.1.x
devices('devices') // => {'device': {'port-name': { ... }}}

// get midiAccess object
devices('access') // => midiAccess

// get midiAccess inputs / outputs iterator
// ** when getting inputs / outputs from the midi Access object you must use the 'midi' param
devices('midi').get('inputs') // => midiInputMap

// if using grouped devices object and a device isn't found ** see Error Handling below
devices('notfound') // => array of notfound ports ['k-mix-audio-control','k-mix-control-surface']
// otherwise returns false
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

If you're passing in an 'grouped devices' object and that device is not connected/found, midi-ports will add a each not-found port to an internal list, allowing for easier error handling. Fallback ports can be setup by using the 'ports' object if desired. For example, you could loop over 'ports' and build a select menu to allow the user to choose an alternate port.

In the case above, if 'k-mix' is not connected/found, querying 'notfound' will return a list like this:

```javascript
devices('notfound') // => ['k-mix-audio-control','k-mix-control-surface']

devices('devices') 
/* => {
	'k-board': {
 		'k-board': {
   	 		name: "K-Board",
    		inputID: "1852960744",
    		outputID: "-162522465",
    		manufacturer: "kesumo-llc"
		}
	}
}
*/
devices('ports') 
/* => {
	'k-board': {
		name: "K-Board",
		inputID: "1852960744",
		outputID: "-162522465",
		manufacturer: "kesumo-llc"
}
*/
```
Which makes it easy to use alternative ports if your desired port isn't connected/found:

```javascript
if(!!ports('notfound')){
	console.warn('device ' + ...devices('notfound') + ' not found')
	
	// use an alternate port from devices('ports')
	// map devices('ports') keys to build select menu
}
```