// class-validator / class-transformer decorators need the metadata polyfill in
// every test file, not only the ones that import Nest.
import 'reflect-metadata';
