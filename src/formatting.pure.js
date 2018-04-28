
export function formatBlock(str) {
	if ( str.length < 70 ) {
		return str.replace(/\n/g, ' ');
	}
	return '\n' + indent(str) + '\n';
}

export function indent(str) {
	return str.split('\n').map(line => '  ' + line).join('\n');
}
