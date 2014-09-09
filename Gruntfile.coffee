# How to build socks-rtc and its various demos.

# TODO: work out an automatic way to only the src we need rather than the whole
# library. Maybe have a separate Gruntfile in each subdirectory with some common
# rules for building a project accoridng to using a standard dir layout.

# Also: provide a way to specify needed modules, and when they are not there to
# give a sensible error.

TaskManager = require 'uproxy-lib/tools/taskmanager'

#-------------------------------------------------------------------------
# Rule-making helper function that assume expected directory layout.
#
# Function to make a copy rule for a module directory, assuming standard
# layout. Copies all non (ts/sass) compiled files into the corresponding
# build directory.
Rule = require 'uproxy-lib/tools/common-grunt-rules'

#-------------------------------------------------------------------------
module.exports = (grunt) ->
  path = require('path');

  #-------------------------------------------------------------------------
  grunt.initConfig {
    pkg: grunt.file.readJSON('package.json')

    symlink:
      # Symlink all module directories in `src` into typescript-src
      typescriptSrc: { files: [ {
        expand: true,
        overwrite: true,
        cwd: 'src',
        src: ['*'],
        dest: 'build/typescript-src/' } ] }
      # Symlink third_party into typescript-src
      thirdPartyTypescriptSrc: { files: [ {
        expand: true,
        overwrite: true,
        cwd: '.',
        src: ['third_party'],
        dest: 'build/typescript-src/' } ] }
      # Symlink third_party into typescript-src
      uproxyLibThirdPartyTypescriptSrc: { files: [ {
        expand: true,
        overwrite: true,
        cwd: 'node_modules/uproxy-lib',
        src: ['third_party'],
        dest: 'build/typescript-src/' } ] }
      uproxyLibTypescriptSrc: { files: [ {
        expand: true,
        overwrite: true,
        cwd: 'node_modules/uproxy-lib/src/',
        src: ['*'],
        dest: 'build/typescript-src/' } ] }

    #-------------------------------------------------------------------------
    copy: {
      # TODO: provide a warning if local project overrides directory?
      #
      # Copy all the built stuff from uproxy-lib
      uproxyLibBuild: { files: [ {
          expand: true, cwd: 'node_modules/uproxy-lib/build'
          src: ['**', '!**/typescript-src/**']
          dest: 'build'
          onlyIf: 'modified'
        } ] }

      # Copy any JavaScript from the third_party directory
      thirdPartyJavaScript: { files: [ {
          expand: true,
          src: ['third_party/**/*.js']
          dest: 'build/'
          onlyIf: 'modified'
        } ] }

      # Copy the ipaddr.js library into the build directory
      ipAddrJavaScript: { files: [ {
          expand: true, cwd: 'node_modules/ipaddr.js'
          src: ['ipaddr.min.js']
          dest: 'build/ipaddr/'
          onlyIf: 'modified'
        } ] }

      # Individual modules.
      tcp: Rule.copyModule 'udp'
      udp: Rule.copyModule 'tcp'
      socks: Rule.copyModule 'socks'
      socksToRtc: Rule.copyModule 'socks-to-rtc'
      rtcToNet: Rule.copyModule 'rtc-to-net'

      # Sample Apps
      echoServerChromeApp: Rule.copySampleFiles 'tcp/samples/echo-server-chromeapp', 'lib'

      socksSamples: Rule.copyModule 'socks-server'
      simpleSocksChromeApp: Rule.copySampleFiles 'socks-server/samples/simple-socks-chromeapp', 'lib'
      simpleSocksFirefoxApp: Rule.copySampleFiles 'socks-server/samples/simple-socks-firefoxapp/data/', 'lib'
      copypasteSocksChromeApp: Rule.copySampleFiles 'socks-server/samples/copypaste-socks-chromeapp', 'lib'
    }  # copy

    #-------------------------------------------------------------------------
    # All typescript compiles to locations in `build/`
    typescript: {
      # From build-tools
      arraybuffers: Rule.typescriptSrc 'arraybuffers'
      handler: Rule.typescriptSrc 'handler'
      # Modules
      tcp: Rule.typescriptSrc 'tcp'
      udp: Rule.typescriptSrc 'udp'
      socks: Rule.typescriptSrc 'socks'
      socksToRtc: Rule.typescriptSrc 'socks-to-rtc'
      rtcToNet: Rule.typescriptSrc 'rtc-to-net'
      # Echo server sample app.
      echoServerChromeApp: Rule.typescriptSrc 'tcp/samples/echo-server-chromeapp'
      # SOCKS server sample apps.
      socksSamples: Rule.typescriptSrc 'socks-server'
      simpleSocksChromeApp: Rule.typescriptSrc 'socks-server/samples/simple-socks-chromeapp'
      simpleSocksFirefoxApp: Rule.typescriptSrc 'socks-server/samples/simple-socks-firefoxapp'
      copypasteSocksChromeApp: Rule.typescriptSrc 'socks-server/samples/copypaste-socks-chromeapp'
    }

    #-------------------------------------------------------------------------
    jasmine: {
      socks:
        src: ['build/socks/socks-headers.js']
        options:
          specs: 'build/socks/socks-headers.spec.js'
          outfile: 'build/socks/_SpecRunner.html'
          keepRunner: true
    }

    clean: ['build/**']

    ccaPath: 'node_modules/cca/src/cca.js'
    ccaCwd: 'build/cca-app'
    exec: {
      adbLog: {
        command: 'adb logcat *:I | grep CONSOLE'
      }
      adbPortForward: {
        command: 'adb forward tcp:10000 tcp:9998'
        exitCode: [0,1]
      }
      ccaCreate: {
        command: '<%= ccaPath %> create build/cca-app --link-to=socks-rtc-net/samples/socks-rtc-net-freedom-chromeapp/manifest.json'
        exitCode: [0,1]
      }
      ccaEmulate: {
        command: '../../<%= ccaPath %> emulate android'
        cwd: '<%= ccaCwd %>'
      }
    }
  }  # grunt.initConfig

  #-------------------------------------------------------------------------
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-jasmine'
  grunt.loadNpmTasks 'grunt-contrib-symlink'
  grunt.loadNpmTasks 'grunt-env'
  grunt.loadNpmTasks 'grunt-exec'
  grunt.loadNpmTasks 'grunt-jasmine-node'
  grunt.loadNpmTasks 'grunt-typescript'

  #-------------------------------------------------------------------------
  # Define the tasks
  taskManager = new TaskManager.Manager();

  taskManager.add 'base', [
    # copy modules from uproxyLibBuild to build/
    'copy:uproxyLibBuild'
    'copy:ipAddrJavaScript'
    # symlink all modules with typescript src to build/typescript-src
    'symlink:uproxyLibTypescriptSrc'
    'symlink:uproxyLibThirdPartyTypescriptSrc'
    'symlink:thirdPartyTypescriptSrc'
    'symlink:typescriptSrc'
  ]

  taskManager.add 'tcp', [
    'base'
    'copy:tcp'
    'typescript:tcp'
  ]

  taskManager.add 'udp', [
    'base'
    'copy:udp'
    'typescript:udp'
  ]

  taskManager.add 'socks', [
    'base'
    'copy:socks'
    'typescript:socks'
    'jasmine:socks'
  ]

  taskManager.add 'socksToRtc', [
    'base'
    'socks'
    'copy:socksToRtc'
    'typescript:socksToRtc'
  ]

  taskManager.add 'rtcToNet', [
    'base'
    'copy:rtcToNet'
    'typescript:rtcToNet'
  ]

  #-------------------------------------------------------------------------
  # tasks for sample apps
  taskManager.add 'echoServer', [
    'base'
    'tcp'
    'typescript:echoServerChromeApp'
    'copy:echoServerChromeApp'
  ]

  taskManager.add 'socksSamples', [
    'base'
    'tcp'
    'udp'
    'socksToRtc'
    'rtcToNet'
    'typescript:socksSamples'
    'copy:socksSamples'
    'typescript:simpleSocksChromeApp'
    'copy:simpleSocksChromeApp'
    'typescript:copypasteSocksChromeApp'
    'copy:copypasteSocksChromeApp'
  ]

  #-------------------------------------------------------------------------
  taskManager.add 'build', [
    'base'
    'tcp'
    'udp'
    'echoServer'
    'socks'
    'socksToRtc'
    'rtcToNet'
    'echoServer'
    'socksSamples'
  ]

  # This is the target run by Travis. Targets in here should run locally
  # and on Travis/Sauce Labs.
  taskManager.add 'test', [
    'build'
    'jasmine:socks'
  ]

  # TODO(yangoon): Figure out how to run our Selenium tests on Sauce Labs and
  #                move this to the test target.
  # TODO(yangoon): Figure out how to spin up Selenium server automatically.
  taskManager.add 'endtoend', [
    'build'
    'env'
    'jasmine_node'
  ]

  taskManager.add 'default', [
    'build'
  ]

  taskManager.add 'cca', [
    'build'
    'exec:ccaCreate'
    'exec:ccaEmulate'
  ]

  #-------------------------------------------------------------------------
  # Register the tasks
  taskManager.list().forEach((taskName) =>
    grunt.registerTask taskName, (taskManager.get taskName)
  );

module.exports.Rule = Rule;
