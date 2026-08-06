import {
	DEFAULT_PASSWORD,
	hashPassword,
	MIN_PASSWORD_LENGTH,
	newNonce,
	writeAuthFile,
} from "./auth-file.server.ts";

/**
 * Reads the new password on stdin rather than argv so it never appears in the
 * process table. `--clear` restores the shipped default.
 */
const password = process.argv.includes("--clear")
	? undefined
	: await new Promise<string>((resolve) => {
			let buffer = "";
			process.stdin.setEncoding("utf8");
			process.stdin.on("data", (chunk) => {
				buffer += chunk;
			});
			process.stdin.on("end", () => resolve(buffer.replace(/\r?\n$/, "")));
		});

if (password === undefined) {
	await writeAuthFile({ hash: hashPassword(DEFAULT_PASSWORD), isDefault: true, nonce: newNonce() });
	console.log("Reset to the default password. Remote unlock is now refused.");
} else if (password.length < MIN_PASSWORD_LENGTH) {
	console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
	process.exit(1);
} else {
	await writeAuthFile({ hash: hashPassword(password), isDefault: false, nonce: newNonce() });
	console.log("Password updated. All devices have been signed out.");
}
