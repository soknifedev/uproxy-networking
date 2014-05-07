TaskManager = require './node_modules/uproxy-build-tools/build/taskmanager/taskmanager'

module.exports = (grunt) ->

  path = require('path');

  grunt.initConfig {
    pkg: grunt.file.readJSON('package.json')

    copy: {
      freedomChrome: { files: [ {
        expand: true, cwd: 'node_modules/freedom-for-chrome/'
        src: ['freedom-for-chrome.js']
        dest: 'build/chrome-app/' } ] }
      freedomFirefox: { files: [ {
        expand: true, cwd: 'node_modules/freedom-for-firefox/'
        src: ['freedom-for-firefox.jsm', 'freedom.map']
        dest: 'build/firefox-app/data' } ] }
      freedomProvidersChrome: { files: [ {
        expand: true, cwd: 'node_modules/freedom/providers/transport/webrtc/'
        src: ['*']
        dest: 'build/chrome-app/freedom-providers' } ] }
      freedomProvidersFirefox: { files: [ {
        expand: true, cwd: 'node_modules/freedom/providers/transport/webrtc/'
        src: ['*']
        dest: 'build/firefox-app/data/freedom-providers' } ] }

      # User should include the compiled source directly from:
      #   - build/socks-to-rtc
      #   - build/rtc-to-net
      socks2rtc: { files: [ {
        expand: true, cwd: 'src/'
        src: ['socks-to-rtc/**/*.json']
        dest: 'build/' } ] }
      rtc2net: { files: [ {
        expand: true, cwd: 'src/'
        src: ['rtc-to-net/**/*.json']
        dest: 'build/' } ] }
      echoChrome: { files: [ {
        expand: true, cwd: 'test/'
        src: ['*.js']
        dest: 'build/chrome-app/socks-to-rtc/' } ] }
      echoFirefox: { files: [ {
        expand: true, cwd: 'test/'
        src: ['*.js']
        dest: 'build/firefox-app/data/socks-to-rtc/' } ] }
      firefoxApp: { files: [ {
          expand: true, cwd: 'src/firefox-app'
          src: ['**/*.json', '**/*.js', '**/*.html', '**/*.css']
          dest: 'build/firefox-app/'
        }, {
          expand: true, cwd: 'src/chrome-app'
          src: ['socks_rtc.json', 'socks_to_rtc_to_net.js']
          dest: 'build/firefox-app/data' 
        }, {
          expand: true, cwd: 'build/socks-to-rtc',
          src: ['**/*.js', '**/*.json'],
          dest: 'build/firefox-app/data/socks-to-rtc'
        }, {
          expand: true, cwd: 'build/rtc-to-net',
          src: ['**/*.js', '**/*.json'],
          dest: 'build/firefox-app/data/rtc-to-net'
        }, {
          expand: true, cwd: 'node_modules/uproxy-build-tools/build/util',
          src: ['**/*.js'],
          dest: 'build/firefox-app/data/util'
        } ] }
      chromeApp: { files: [ {
          expand: true, cwd: 'src/chrome-app'
          src: ['**/*.json', '**/*.js', '**/*.html', '**/*.css']
          dest: 'build/chrome-app/'
        }, {
          expand: true, cwd: 'build/socks-to-rtc',
          src: ['**/*.js', '**/*.json'],
          dest: 'build/chrome-app/socks-to-rtc'
        }, {
          expand: true, cwd: 'build/rtc-to-net',
          src: ['**/*.js', '**/*.json'],
          dest: 'build/chrome-app/rtc-to-net'
        }, {
          expand: true, cwd: 'node_modules/uproxy-build-tools/build/util',
          src: ['**/*.js'],
          dest: 'build/chrome-app/util'
        } ] }
    }

    #-------------------------------------------------------------------------
    # All typescript compiles to build/ initially.
    typescript: {
      socks2rtc:
        src: ['src/socks-to-rtc/**/*.ts']
        dest: 'build/'
        options: { basePath: 'src', ignoreError: false }
      rtc2net:
        src: ['src/rtc-to-net/**/*.ts']
        dest: 'build/'
        options: { basePath: 'src', ignoreError: false }
      chromeApp:
        src: ['src/chrome-app/**/*.ts']
        dest: 'build/'
        options: { basePath: 'src/', ignoreError: false }
    }

    jasmine: {
      socksToRtc:
        src: ['build/chrome-app/socks-to-rtc/socks-headers.js']
        options : { specs : 'build/socks-to-rtc/**/*.spec.js' }
    }

    env: {
      jasmine_node: {
        # Will be available to tests as process.env['CHROME_EXTENSION_PATH'].
        CHROME_EXTENSION_PATH: path.resolve('build/chrome-app')
      }
    }

    jasmine_node:
      # Match only specs whose filenames begin with endtoend.
      options: {
        match: 'endtoend.*'
      }
      projectRoot: 'build/chrome-app'

    clean: ['build/**']
  }  # grunt.initConfig

  #-------------------------------------------------------------------------
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-jasmine'
  grunt.loadNpmTasks 'grunt-typescript'
  grunt.loadNpmTasks 'grunt-jasmine-node'
  grunt.loadNpmTasks 'grunt-env'

  #-------------------------------------------------------------------------
  # Define the tasks
  taskManager = new TaskManager.Manager();

  taskManager.add 'build', [
    'typescript:socks2rtc'
    'typescript:rtc2net'
    'typescript:chromeApp'
    'copy:freedomChrome'
    'copy:freedomFirefox'
    'copy:freedomProvidersChrome'
    'copy:freedomProvidersFirefox'
    'copy:socks2rtc'
    'copy:rtc2net'
    'copy:echoChrome'
    'copy:echoFirefox'
    'copy:chromeApp'
    'copy:firefoxApp'
  ]

  # This is the target run by Travis. Targets in here should run locally
  # and on Travis/Sauce Labs.
  taskManager.add 'test', [
    'build'
    'jasmine:socksToRtc'
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

  #-------------------------------------------------------------------------
  # Register the tasks
  taskManager.list().forEach((taskName) =>
    grunt.registerTask taskName, (taskManager.get taskName)
  );
