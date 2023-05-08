import { type Output } from "@pulumi/pulumi"

export type Tuple<K extends string = string, V extends any = Output<string> | string> = [K, V]
