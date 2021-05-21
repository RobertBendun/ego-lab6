import axios from 'axios';
import fs from 'fs';
import lodash, { add } from 'lodash';

const Cache_Directory = './cache';
const Address = 'mrenegoxBpVDwia9kr6PMrNcLiK3qb3t7F';

function write_to_file(cache : fs.PathLike, data : any) {
	if (!fs.existsSync(Cache_Directory)) {
		fs.mkdirSync(Cache_Directory);
	}
	fs.writeFileSync(cache, JSON.stringify(data, null, 2));
}

type Output = {
	value: number;
	addresses: string[];
};

type Input = {
	addresses: string[];
};

type Transaction = {
	hash: string;
	received: string;
	value: number;
	block_height: number;
	outputs: Output[];
	inputs: Input[];
};

type Blockcypher_Response = {
	txs: Transaction[];
};

async function request(block_height : number) : Promise<Blockcypher_Response> {
	const [uri, cache] = function() {
		if (block_height >= 1/0) {
			return [
				`https://api.blockcypher.com/v1/btc/test3/addrs/${Address}/full?limit=30`,
				`${Cache_Directory}/${Address}`
			];
		}
		return [
			`https://api.blockcypher.com/v1/btc/test3/addrs/${Address}/full?before=${block_height}&limit=30`,
			`${Cache_Directory}/${Address}-${block_height}`
		]
	}()
	
	if (fs.existsSync(cache)) {
		const modification_time = fs.statSync(cache).mtimeMs;
		if ((Date.now() - modification_time) / 1000 / 60 < 60) {
			console.info('Using cached data');
			const content = fs.readFileSync(cache, 'utf-8');
			return JSON.parse(content);
		}
	}
	
	const response = await axios.get(uri);
	if (response.status !== 200) {
		throw new Error(`Failed to request ${Address}. Response:\n${response.data}`)
	}
	write_to_file(cache, response.data);
	return response.data;
}

async function main() {
	console.clear();
	const transactions = [] as Transaction[];

	let block_height = 1/0;
	for (let done = false; !done; ) {
		const result = await request(block_height);
		for (const transaction of result.txs) {
			const time = new Date(transaction.received);
			if (time.getFullYear() !== 2021 || time.getMonth() < 3) {
				done = true;
				break;
			}
			transactions.push(transaction);
			block_height = Math.min(block_height, transaction.block_height);
		}
		if (result.txs.length === 0)
			break;
	}

	const indexes = [] as number[];
	const seenInputs = {} as { [name: string]: number; };

	function check_if_address_in_set(transaction : Transaction, value : number) {
		for (const { addresses } of transaction.inputs) {
			for (const address of lodash.uniq(addresses)) {
				if (seenInputs[address] && seenInputs[address] != value) {
					/* we have problem */
					console.error('!!!', transaction.hash, value, seenInputs[address]);
					seenInputs[address] = value;
					return true;
				}
				seenInputs[address] = value;
			}
		}
		return false;
	}

	for (const transaction of transactions) {
		for (const output of transaction.outputs) {
			if (output.addresses && output.addresses.indexOf(Address) >= 0 && output.value >= 999) {
				const value = output.value % 1_000_000;
				if (value >= 200_000 && value <= 500_000) {
					if (check_if_address_in_set(transaction, value)) {
						continue;
					}
					indexes.push(value);
				}
			}
		}
	}

	for (const index of lodash.uniq(indexes.reverse())) {
		console.log(index);
	}
}

main();
